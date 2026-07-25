// server/test/v16.test.ts
// v1.6 test suite:
//   - chain registry validation (missing/invalid env fails fast)
//   - per-chain client factory isolation
//   - worker per-chain error isolation semantics (Promise.allSettled)
//   - health status derivation matrix
//   - retention aggregation math (12+ cases)
// All network and DB mocked / pure — no I/O.

import { describe, it, expect, beforeEach } from "vitest";
import {
  CHAINS,
  CHAIN_SLUGS,
  chainBySlug,
  chainById,
  isChainSlug,
  parseEnabledChains,
  resolveChainEnv,
  validateChainEnv,
  explorerTxUrl,
} from "../../shared/chains";
import { ChainClientFactory } from "../src/lib/chainClients";
import { deriveStatus, healthService, subgraphDep } from "../src/lib/health";
import {
  aggregateSnapshotsToDaily,
  utcDayStart,
  type RawSnapshotForAggregation,
} from "../src/services/retention";

// ---- 1. Chain registry validation ----

describe("chain registry", () => {
  it("has all three testnets with unique chainIds", () => {
    expect(CHAIN_SLUGS).toEqual(["sepolia", "arbitrum-sepolia", "base-sepolia"]);
    const ids = CHAIN_SLUGS.map((s) => CHAINS[s].chainId);
    expect(new Set(ids).size).toBe(3);
    expect(CHAINS.sepolia.chainId).toBe(11155111);
    expect(CHAINS["arbitrum-sepolia"].chainId).toBe(421614);
    expect(CHAINS["base-sepolia"].chainId).toBe(84532);
  });

  it("resolves lookups by slug and id", () => {
    expect(chainBySlug("base-sepolia")?.chainId).toBe(84532);
    expect(chainBySlug("mainnet")).toBeUndefined();
    expect(chainById(421614)?.slug).toBe("arbitrum-sepolia");
    expect(chainById(1)).toBeUndefined();
    expect(isChainSlug("sepolia")).toBe(true);
    expect(isChainSlug("ethereum")).toBe(false);
  });

  it("builds explorer links from the registry", () => {
    expect(explorerTxUrl("sepolia", "0xabc")).toBe(
      "https://sepolia.etherscan.io/tx/0xabc"
    );
    expect(explorerTxUrl("base-sepolia", "0xdef")).toContain(
      "sepolia.basescan.org"
    );
  });

  it("validateChainEnv passes with defaults (no env set)", () => {
    const v = validateChainEnv({});
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
    expect(v.resolved.sepolia.rpcUrl).toBe(CHAINS.sepolia.defaultRpcUrl);
  });

  it("validateChainEnv fails fast on an invalid RPC URL", () => {
    const v = validateChainEnv({ SEPOLIA_RPC_URL: "not-a-url" });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("SEPOLIA_RPC_URL"))).toBe(true);
  });

  it("validateChainEnv fails fast on an invalid subgraph URL for any chain", () => {
    const v = validateChainEnv({
      BASE_SEPOLIA_SUBGRAPH_URL: "ftp://bad-protocol",
    });
    expect(v.ok).toBe(false);
    expect(
      v.errors.some((e) => e.includes("BASE_SEPOLIA_SUBGRAPH_URL"))
    ).toBe(true);
  });

  it("env overrides win over defaults; legacy SUBGRAPH_URL applies to sepolia", () => {
    const r = resolveChainEnv(CHAINS.sepolia, {
      SUBGRAPH_URL: "https://legacy.example.com/subgraph",
    });
    expect(r.subgraphUrl).toBe("https://legacy.example.com/subgraph");
    const r2 = resolveChainEnv(CHAINS["arbitrum-sepolia"], {
      SUBGRAPH_URL: "https://legacy.example.com/subgraph",
      ARBITRUM_SEPOLIA_RPC_URL: "https://arb.example.com",
    });
    // legacy var must NOT leak to other chains
    expect(r2.subgraphUrl).toBe(CHAINS["arbitrum-sepolia"].defaultSubgraphUrl);
    expect(r2.rpcUrl).toBe("https://arb.example.com");
  });

  it("parseEnabledChains handles subsets and rejects unknown slugs", () => {
    expect(parseEnabledChains(undefined).slugs).toHaveLength(3);
    const sub = parseEnabledChains("sepolia, base-sepolia");
    expect(sub.slugs).toEqual(["sepolia", "base-sepolia"]);
    expect(sub.errors).toHaveLength(0);
    const bad = parseEnabledChains("sepolia,mainnet");
    expect(bad.errors.some((e) => e.includes("mainnet"))).toBe(true);
  });
});

// ---- 2. Per-chain client factory isolation ----

describe("ChainClientFactory", () => {
  const env = {
    sepolia: { rpcUrl: "https://rpc-a.test", subgraphUrl: "https://sg-a.test" },
    "arbitrum-sepolia": {
      rpcUrl: "https://rpc-b.test",
      subgraphUrl: "https://sg-b.test",
    },
    "base-sepolia": {
      rpcUrl: "https://rpc-c.test",
      subgraphUrl: "https://sg-c.test",
    },
  } as const;

  it("returns a distinct, cached UniswapClient per chain", () => {
    const f = new ChainClientFactory(
      ["sepolia", "arbitrum-sepolia", "base-sepolia"],
      env as never
    );
    const a = f.uniswap("sepolia");
    const b = f.uniswap("arbitrum-sepolia");
    expect(a).not.toBe(b);
    expect(a.chain.chainId).toBe(11155111);
    expect(b.chain.chainId).toBe(421614);
    // cached — same instance on repeat calls
    expect(f.uniswap("sepolia")).toBe(a);
  });

  it("uses per-chain subgraph and RPC URLs (no cross-chain leakage)", () => {
    const f = new ChainClientFactory(
      ["sepolia", "base-sepolia"],
      env as never
    );
    expect(f.subgraphUrl("sepolia")).toBe("https://sg-a.test");
    expect(f.subgraphUrl("base-sepolia")).toBe("https://sg-c.test");
    expect(f.rpcUrl("base-sepolia")).toBe("https://rpc-c.test");
  });

  it("rejects disabled chains with a 400-class error", () => {
    const f = new ChainClientFactory(["sepolia"], env as never);
    expect(() => f.uniswap("base-sepolia")).toThrowError(/not enabled/);
    expect(f.isEnabled("sepolia")).toBe(true);
    expect(f.isEnabled("base-sepolia")).toBe(false);
  });
});

// ---- 3. Worker per-chain error isolation ----

describe("worker per-chain error isolation", () => {
  it("one chain failing never stops the others (allSettled semantics)", async () => {
    const ran: string[] = [];
    const tickChain = async (slug: string): Promise<void> => {
      if (slug === "arbitrum-sepolia") throw new Error("subgraph down");
      ran.push(slug);
    };
    const results = await Promise.allSettled(
      ["sepolia", "arbitrum-sepolia", "base-sepolia"].map((s) => tickChain(s))
    );
    expect(ran).toEqual(["sepolia", "base-sepolia"]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
    expect((results[1] as PromiseRejectedResult).reason.message).toBe(
      "subgraph down"
    );
  });
});

// ---- 4. Health status derivation matrix ----

describe("health status derivation", () => {
  const cases: Array<{
    name: string;
    success: number;
    errors: number;
    lastOk: boolean | null;
    expected: string;
  }> = [
    { name: "no samples -> unknown", success: 0, errors: 0, lastOk: null, expected: "unknown" },
    { name: "all success -> ok", success: 10, errors: 0, lastOk: true, expected: "ok" },
    { name: "single success -> ok", success: 1, errors: 0, lastOk: true, expected: "ok" },
    { name: "low error rate -> degraded", success: 9, errors: 1, lastOk: true, expected: "degraded" },
    { name: "49% errors -> degraded", success: 51, errors: 49, lastOk: true, expected: "degraded" },
    { name: "50% errors, last error -> down", success: 5, errors: 5, lastOk: false, expected: "down" },
    { name: "all errors -> down", success: 0, errors: 8, lastOk: false, expected: "down" },
    { name: "high errors but recovering (last ok) -> degraded", success: 2, errors: 8, lastOk: true, expected: "degraded" },
    { name: "single error -> down", success: 0, errors: 1, lastOk: false, expected: "down" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(deriveStatus(c.success, c.errors, c.lastOk)).toBe(c.expected);
    });
  }

  it("healthService rolling snapshot reflects recorded samples", () => {
    healthService.clear();
    const dep = subgraphDep("sepolia");
    healthService.recordSuccess(dep);
    healthService.recordSuccess(dep);
    healthService.recordError(dep, "HTTP 502");
    const snap = healthService.snapshot(dep);
    expect(snap.successCount).toBe(2);
    expect(snap.errorCount).toBe(1);
    expect(snap.status).toBe("degraded");
    expect(snap.lastError).toBe("HTTP 502");
  });

  it("snapshotAll includes ensured dependencies with unknown status", () => {
    healthService.clear();
    const all = healthService.snapshotAll(["defillama", "db"]);
    expect(all.map((d) => d.name).sort()).toEqual(["db", "defillama"]);
    expect(all.every((d) => d.status === "unknown")).toBe(true);
  });
});

// ---- 5. Retention aggregation math (12+ cases) ----

describe("retention aggregation math", () => {
  const DAY = 86_400_000;
  const day0 = utcDayStart(Date.UTC(2026, 0, 10, 15, 30)); // arbitrary day

  function snap(
    over: Partial<RawSnapshotForAggregation>
  ): RawSnapshotForAggregation {
    return {
      positionId: "p1",
      chainId: 11155111,
      ts: day0 + 3_600_000,
      valueUsd: 100,
      unclaimedFeesUsd: 1,
      ilPct: -1,
      inRange: true,
      ...over,
    };
  }

  it("1. empty input -> empty output", () => {
    expect(aggregateSnapshotsToDaily([])).toEqual([]);
  });

  it("2. single snapshot -> single aggregate with its own values", () => {
    const [a] = aggregateSnapshotsToDaily([snap({ valueUsd: 250 })]);
    expect(a.avgValueUsd).toBe(250);
    expect(a.minValueUsd).toBe(250);
    expect(a.maxValueUsd).toBe(250);
    expect(a.sampleCount).toBe(1);
  });

  it("3. avgValueUsd is the arithmetic mean", () => {
    const [a] = aggregateSnapshotsToDaily([
      snap({ valueUsd: 100 }),
      snap({ valueUsd: 200 }),
      snap({ valueUsd: 300 }),
    ]);
    expect(a.avgValueUsd).toBe(200);
  });

  it("4. min/max value bracket the samples", () => {
    const [a] = aggregateSnapshotsToDaily([
      snap({ valueUsd: 80 }),
      snap({ valueUsd: 120 }),
      snap({ valueUsd: 95 }),
    ]);
    expect(a.minValueUsd).toBe(80);
    expect(a.maxValueUsd).toBe(120);
  });

  it("5. fee aggregates: avg and max", () => {
    const [a] = aggregateSnapshotsToDaily([
      snap({ unclaimedFeesUsd: 2 }),
      snap({ unclaimedFeesUsd: 6 }),
    ]);
    expect(a.avgUnclaimedFeesUsd).toBe(4);
    expect(a.maxUnclaimedFeesUsd).toBe(6);
  });

  it("6. avgIlPct averages negative values correctly", () => {
    const [a] = aggregateSnapshotsToDaily([
      snap({ ilPct: -2 }),
      snap({ ilPct: -4 }),
    ]);
    expect(a.avgIlPct).toBe(-3);
  });

  it("7. inRangeRatio = fraction of in-range samples", () => {
    const [a] = aggregateSnapshotsToDaily([
      snap({ inRange: true }),
      snap({ inRange: true }),
      snap({ inRange: false }),
      snap({ inRange: false }),
    ]);
    expect(a.inRangeRatio).toBe(0.5);
  });

  it("8. inRangeRatio is 0 when never in range, 1 when always", () => {
    const [never] = aggregateSnapshotsToDaily([
      snap({ inRange: false }),
      snap({ inRange: false }),
    ]);
    expect(never.inRangeRatio).toBe(0);
    const [always] = aggregateSnapshotsToDaily([snap({}), snap({})]);
    expect(always.inRangeRatio).toBe(1);
  });

  it("9. snapshots on different UTC days produce separate rows", () => {
    const out = aggregateSnapshotsToDaily([
      snap({ ts: day0 + 1000 }),
      snap({ ts: day0 + DAY + 1000 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].day).toBe(day0);
    expect(out[1].day).toBe(day0 + DAY);
  });

  it("10. midnight boundary: 23:59:59.999 stays in the day, 00:00 starts next", () => {
    const out = aggregateSnapshotsToDaily([
      snap({ ts: day0 + DAY - 1 }),
      snap({ ts: day0 + DAY }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].sampleCount).toBe(1);
    expect(out[1].sampleCount).toBe(1);
  });

  it("11. different positions on the same day produce separate rows", () => {
    const out = aggregateSnapshotsToDaily([
      snap({ positionId: "p1" }),
      snap({ positionId: "p2" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.positionId).sort()).toEqual(["p1", "p2"]);
  });

  it("12. chainId is carried through to the aggregate", () => {
    const [a] = aggregateSnapshotsToDaily([snap({ chainId: 84532 })]);
    expect(a.chainId).toBe(84532);
  });

  it("13. output is sorted by day then positionId", () => {
    const out = aggregateSnapshotsToDaily([
      snap({ positionId: "b", ts: day0 + DAY }),
      snap({ positionId: "a", ts: day0 + DAY }),
      snap({ positionId: "z", ts: day0 }),
    ]);
    expect(out.map((o) => `${o.day === day0 ? 0 : 1}:${o.positionId}`)).toEqual([
      "0:z",
      "1:a",
      "1:b",
    ]);
  });

  it("14. utcDayStart floors to UTC midnight", () => {
    const ts = Date.UTC(2026, 5, 15, 23, 59, 59);
    expect(utcDayStart(ts)).toBe(Date.UTC(2026, 5, 15));
    expect(utcDayStart(Date.UTC(2026, 5, 15))).toBe(Date.UTC(2026, 5, 15));
  });

  it("15. sampleCount matches contributing snapshots per row", () => {
    const out = aggregateSnapshotsToDaily([
      snap({}),
      snap({}),
      snap({}),
      snap({ positionId: "p2" }),
    ]);
    const p1 = out.find((o) => o.positionId === "p1")!;
    const p2 = out.find((o) => o.positionId === "p2")!;
    expect(p1.sampleCount).toBe(3);
    expect(p2.sampleCount).toBe(1);
  });
});
