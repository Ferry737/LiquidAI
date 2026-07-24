// server/test/v14.test.ts
// v1.4 test suite: SIWE verify flow (valid sig, wrong address, expired nonce,
// ownership check), JWT round-trip, and backtester math on synthetic fixtures.
// All network and DB calls are mocked — signature crypto runs locally.

import { describe, it, expect, vi, afterEach } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { recoverMessageAddress, type Hex } from "viem";
import {
  generateNonce,
  consumeNonce,
  verifySiwe,
  setSiweClient,
  assertOwnership,
  type AuthSession,
} from "../src/lib/auth";
import { signSessionToken, verifySessionToken } from "../src/lib/jwt";
import { ApiError } from "../src/lib/errors";
import {
  runBacktest,
  impermanentLoss,
  type PoolHourBar,
} from "../src/services/backtester";

// ------------------------------------------------------------------
// Test wallet (well-known throwaway key — never holds funds).
// ------------------------------------------------------------------
const PRIV = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const account = privateKeyToAccount(PRIV);
const OTHER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

// Mock viem client: local ecrecover, no RPC (EOA-only, which is what we test).
setSiweClient({
  verifySiweMessage: async ({
    message,
    signature,
    address,
  }: {
    message: string;
    signature: Hex;
    address: string;
  }) => {
    const recovered = await recoverMessageAddress({ message, signature });
    return recovered.toLowerCase() === address.toLowerCase();
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

function buildSiweMessage(address: `0x${string}`, nonce: string): string {
  return createSiweMessage({
    domain: "localhost", // matches FRONTEND_ORIGIN default hostname
    address,
    statement: "Sign in to LiquidAI to manage your strategies.",
    uri: "http://localhost:3000",
    version: "1",
    chainId: 11155111,
    nonce,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

// ==================================================================
// 1. SIWE VERIFY FLOW
// ==================================================================

describe("SIWE verify flow", () => {
  it("accepts a valid signature and returns the lowercased address", async () => {
    const nonce = generateNonce("session-a");
    const message = buildSiweMessage(account.address, nonce);
    const signature = await account.signMessage({ message });

    const expected = consumeNonce("session-a");
    expect(expected).toBe(nonce);

    const result = await verifySiwe(message, signature, expected!);
    expect(result.ok).toBe(true);
    expect(result.address).toBe(account.address.toLowerCase());
  });

  it("rejects when the message claims a different address than the signer", async () => {
    const nonce = generateNonce("session-b");
    // Message claims OTHER_ADDRESS but is signed by `account`.
    const message = buildSiweMessage(OTHER_ADDRESS as `0x${string}`, nonce);
    const signature = await account.signMessage({ message });

    const result = await verifySiwe(message, signature, nonce);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/signature verification failed/i);
  });

  it("rejects a nonce mismatch", async () => {
    const nonce = generateNonce("session-c");
    const message = buildSiweMessage(account.address, nonce);
    const signature = await account.signMessage({ message });

    const result = await verifySiwe(message, signature, "some-other-nonce");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/nonce mismatch/i);
  });

  it("expires nonces after the TTL", () => {
    vi.useFakeTimers();
    generateNonce("session-d");
    vi.advanceTimersByTime(11 * 60 * 1000); // TTL is 10 minutes
    expect(consumeNonce("session-d")).toBeNull();
  });

  it("nonces are one-time use", () => {
    const nonce = generateNonce("session-e");
    expect(consumeNonce("session-e")).toBe(nonce);
    expect(consumeNonce("session-e")).toBeNull();
  });

  it("rejects malformed SIWE messages", async () => {
    const result = await verifySiwe("not a siwe message", "0xdead", "n");
    expect(result.ok).toBe(false);
  });
});

// ==================================================================
// 2. OWNERSHIP CHECK
// ==================================================================

describe("assertOwnership", () => {
  const session: AuthSession = {
    address: account.address.toLowerCase(),
    authenticatedAt: Date.now(),
    expiresAt: Date.now() + 1000,
  };

  it("passes when session address matches owner (case-insensitive)", () => {
    expect(() =>
      assertOwnership(session, account.address.toUpperCase().replace("0X", "0x"))
    ).not.toThrow();
  });

  it("throws 403 when the session address does not match the owner", () => {
    try {
      assertOwnership(session, OTHER_ADDRESS);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).statusCode).toBe(403);
    }
  });

  it("throws 401 when there is no session", () => {
    try {
      assertOwnership(null, OTHER_ADDRESS);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as ApiError).statusCode).toBe(401);
    }
  });
});

// ==================================================================
// 3. JWT SESSION TOKENS
// ==================================================================

describe("JWT session tokens", () => {
  it("round-trips a wallet address", async () => {
    const token = await signSessionToken(account.address);
    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(account.address.toLowerCase());
  });

  it("rejects tampered tokens", async () => {
    const token = await signSessionToken(account.address);
    const tampered = token.slice(0, -4) + "AAAA";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage tokens", async () => {
    expect(await verifySessionToken("not.a.jwt")).toBeNull();
  });
});

// ==================================================================
// 4. BACKTESTER MATH (synthetic fixtures)
// ==================================================================

const HOUR = 3600 * 1000;

function bar(i: number, price: number, feesUsd = 0, tvlUsd = 1_000_000): PoolHourBar {
  return { ts: i * HOUR, price, tvlUsd, volumeUsd: feesUsd * 300, feesUsd };
}

function flatBars(n: number, price: number, feesUsd = 0, tvlUsd = 1_000_000): PoolHourBar[] {
  return Array.from({ length: n }, (_, i) => bar(i, price, feesUsd, tvlUsd));
}

const NO_STOP = {
  rebalanceAfterHrs: 999,
  compoundMinUsd: 1_000_000,
  maxSlippagePct: 0.5,
  stopLossIlPct: null,
};

describe("backtester", () => {
  // 1
  it("returns the initial value for an empty bar set", () => {
    const r = runBacktest({ bars: [], initialUsd: 1000, rangeWidthPct: 15, config: NO_STOP });
    expect(r.finalValueUsd).toBe(1000);
    expect(r.hodlValueUsd).toBe(1000);
    expect(r.series).toHaveLength(0);
  });

  // 2
  it("flat price with zero fees ends exactly at the initial value", () => {
    const r = runBacktest({ bars: flatBars(48, 100), initialUsd: 1000, rangeWidthPct: 15, config: NO_STOP });
    expect(r.finalValueUsd).toBeCloseTo(1000, 2);
    expect(r.feesEarnedUsd).toBe(0);
    expect(r.netVsHodlPct).toBeCloseTo(0, 2);
    expect(r.rebalanceCount).toBe(0);
    expect(r.gasSpentUsd).toBe(0);
  });

  // 3
  it("always-in-range with fees beats HODL on a flat price", () => {
    const r = runBacktest({
      bars: flatBars(48, 100, 100, 1_000_000), // share = 1000/1e6 → $0.10/h
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: NO_STOP,
    });
    expect(r.feesEarnedUsd).toBeGreaterThan(0);
    expect(r.finalValueUsd).toBeGreaterThan(r.hodlValueUsd);
    expect(r.netVsHodlPct).toBeGreaterThan(0);
  });

  // 4
  it("always-out-of-range earns no fees and never rebalances (threshold too high)", () => {
    const bars = [bar(0, 100, 0), ...Array.from({ length: 24 }, (_, i) => bar(i + 1, 1000, 500))];
    const r = runBacktest({ bars, initialUsd: 1000, rangeWidthPct: 15, config: NO_STOP });
    expect(r.feesEarnedUsd).toBe(0);
    expect(r.rebalanceCount).toBe(0);
  });

  // 5
  it("rebalance triggers after rebalanceAfterHrs consecutive out-of-range hours", () => {
    const bars = [bar(0, 100), bar(1, 200), bar(2, 200), bar(3, 200)];
    const r = runBacktest({
      bars,
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, rebalanceAfterHrs: 2 },
    });
    expect(r.rebalanceCount).toBe(1);
    expect(r.gasSpentUsd).toBeGreaterThan(0);
  });

  // 6
  it("rebalance does NOT trigger before the threshold is reached", () => {
    const bars = [bar(0, 100), bar(1, 200)]; // only 1h out of range
    const r = runBacktest({
      bars,
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, rebalanceAfterHrs: 2 },
    });
    expect(r.rebalanceCount).toBe(0);
  });

  // 7
  it("each rebalance deducts the gas estimate from position value", () => {
    const bars = [bar(0, 100), bar(1, 200), bar(2, 200)];
    const r = runBacktest({
      bars,
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, rebalanceAfterHrs: 2 },
      gasPerActionUsd: 7,
    });
    expect(r.rebalanceCount).toBe(1);
    expect(r.gasSpentUsd).toBe(7);
    // Value was frozen at 1000 while out of range, then gas deducted.
    expect(r.finalValueUsd).toBeCloseTo(993, 2);
  });

  // 8
  it("stop-loss closes the position when IL exceeds the threshold", () => {
    // Price halves: IL = 2*sqrt(0.5)/1.5 - 1 ≈ -5.72% → triggers 5% stop.
    const bars = [bar(0, 100), bar(1, 50), bar(2, 25), bar(3, 10)];
    const r = runBacktest({
      bars,
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, stopLossIlPct: 5 },
    });
    // Value frozen after the stop — the last two series points are equal.
    const n = r.series.length;
    expect(r.series[n - 1].valueUsd).toBe(r.series[n - 2].valueUsd);
    // And final value does not track the 90% price collapse.
    expect(r.finalValueUsd).toBeGreaterThan(r.hodlValueUsd);
  });

  // 9
  it("no stop-loss when stopLossIlPct is null, even on a crash", () => {
    const bars = [bar(0, 100), bar(1, 10), bar(2, 10)];
    const r = runBacktest({
      bars,
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, stopLossIlPct: null, rebalanceAfterHrs: 1 },
    });
    // Position kept simulating: it rebalanced instead of stopping.
    expect(r.rebalanceCount).toBeGreaterThan(0);
  });

  // 10
  it("compound rule folds unclaimed fees into principal and pays gas", () => {
    // share = min(0.5, 10000/20000) = 0.5 → $15/h fees, compounds every hour.
    const r = runBacktest({
      bars: flatBars(10, 100, 30, 20_000),
      initialUsd: 10_000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, compoundMinUsd: 10 },
      gasPerActionUsd: 3,
    });
    expect(r.gasSpentUsd).toBeGreaterThan(0);
    expect(r.feesEarnedUsd).toBeGreaterThan(100);
    // Compounded: final > initial + (fees - gas) would hold only w/o compounding
    expect(r.finalValueUsd).toBeGreaterThan(10_000);
  });

  // 11
  it("fees below the compound threshold stay unclaimed but count in final value", () => {
    const r = runBacktest({
      bars: flatBars(5, 100, 10, 1_000_000), // tiny fees, never compound
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: { ...NO_STOP, compoundMinUsd: 1_000_000 },
    });
    expect(r.gasSpentUsd).toBe(0);
    expect(r.finalValueUsd).toBeCloseTo(1000 + r.feesEarnedUsd, 2);
  });

  // 12
  it("series has one point per bar with preserved timestamps", () => {
    const bars = flatBars(24, 100);
    const r = runBacktest({ bars, initialUsd: 1000, rangeWidthPct: 15, config: NO_STOP });
    expect(r.series).toHaveLength(24);
    expect(r.series[0].ts).toBe(bars[0].ts);
    expect(r.series[23].ts).toBe(bars[23].ts);
  });

  // 13
  it("impermanentLoss math is correct at known points", () => {
    expect(impermanentLoss(1)).toBeCloseTo(0, 10);
    expect(impermanentLoss(4)).toBeCloseTo(2 * 2 / 5 - 1, 10); // -0.2
    expect(impermanentLoss(0.25)).toBeCloseTo(2 * 0.5 / 1.25 - 1, 10); // -0.2
    expect(impermanentLoss(0)).toBe(-1);
  });

  // 14
  it("HODL benchmark scales linearly with price", () => {
    const bars = [bar(0, 100), bar(1, 110)];
    const r = runBacktest({ bars, initialUsd: 1000, rangeWidthPct: 50, config: NO_STOP });
    expect(r.hodlValueUsd).toBeCloseTo(1100, 2);
  });

  // 15
  it("in-range LP value tracks HODL minus IL (never above HODL w/o fees)", () => {
    const bars = [bar(0, 100), bar(1, 110), bar(2, 120)]; // ±25% range holds
    const r = runBacktest({ bars, initialUsd: 1000, rangeWidthPct: 50, config: NO_STOP });
    expect(r.finalValueUsd).toBeLessThanOrEqual(r.hodlValueUsd);
    expect(r.ilUsd).toBeLessThanOrEqual(0);
  });

  // 16
  it("fee share is capped at 50% of pool fees", () => {
    // Position 10x larger than pool TVL — share must clamp to 0.5.
    const r = runBacktest({
      bars: flatBars(2, 100, 100, 100),
      initialUsd: 1000,
      rangeWidthPct: 15,
      config: NO_STOP,
    });
    expect(r.feesEarnedUsd).toBeLessThanOrEqual(2 * 100 * 0.5 + 0.01);
  });
});
