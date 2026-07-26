// server/test/v17.test.ts
// LiquidAI v1.7 mainnet-readiness security matrix. Network, KMS, and storage are
// injected/mocked; signature recovery uses local viem cryptography only.

import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex, TransactionSerializable } from "viem";
import {
  evaluatePolicy,
  type PolicyContext,
  type PolicyRequest,
} from "../src/services/policy";
import {
  clampToCeiling,
  buildMainnetAckMessage,
  MAINNET_ACK_MAX_AGE_MS,
  MAINNET_POLICY_CEILING,
} from "../../shared/policy";
import {
  AbstractSigner,
  KmsSigner,
  KeystoreSigner,
  SignerRefusedError,
  selectSignerProvider,
  type SignerService,
} from "../src/services/signer";
import { verifyMainnetAck } from "../src/services/mainnetOptIn";
import {
  evaluateGuard,
  GuardService,
} from "../src/services/guard";
import {
  auditPlugin,
  createAuditWriter,
  PRIVILEGED_AUDIT_ACTIONS,
} from "../src/lib/audit";

const POOL = "0x00000000000000000000000000000000000000aa";
const TOKEN0 = "0x00000000000000000000000000000000000000b0";
const TOKEN1 = "0x00000000000000000000000000000000000000b1";

const limits = {
  maxUsdPerAction: 500,
  maxActionsPerPositionPerDay: 4,
  maxDailyGasUsd: 50,
  allowedPools: [POOL],
  allowedTokens: [TOKEN0, TOKEN1],
};

const baseRequest: PolicyRequest = {
  chainId: 11155111,
  positionId: "pos-1",
  actionType: "COMPOUND",
  usdValue: 100,
  gasCostUsd: 2,
  pool: POOL,
  tokens: [TOKEN0, TOKEN1],
  positionMainnetEnabled: false,
  actionsInLast24h: 0,
  gasSpentUsdLast24h: 0,
};

const baseContext: PolicyContext = {
  limits,
  mainnetExecutionEnabled: false,
};

function deny(req: Partial<PolicyRequest>, ctx: Partial<PolicyContext> = {}) {
  const decision = evaluatePolicy(
    { ...baseRequest, ...req },
    { ...baseContext, ...ctx }
  );
  expect(decision.approved).toBe(false);
  if (decision.approved) throw new Error("expected denial");
  return decision.code;
}

// ---------------------------------------------------------------------------
// Policy engine: 20-case full matrix (caps, allowlists, counters, mainnet gate)
// ---------------------------------------------------------------------------
describe("PolicyEngine security matrix", () => {
  it("1 approves a testnet action exactly at all caps", () => {
    const result = evaluatePolicy(
      {
        ...baseRequest,
        usdValue: 500,
        gasCostUsd: 2,
        actionsInLast24h: 3,
        gasSpentUsdLast24h: 48,
      },
      baseContext
    );
    expect(result.approved).toBe(true);
  });

  it("2 blocks USD notional over the per-action cap", () => {
    expect(deny({ usdValue: 500.01 })).toBe("MAX_USD_PER_ACTION");
  });

  it("3 blocks a pool outside the allowlist", () => {
    expect(deny({ pool: "0x00000000000000000000000000000000000000ff" })).toBe(
      "POOL_NOT_ALLOWED"
    );
  });

  it("4 compares pool addresses case-insensitively", () => {
    const result = evaluatePolicy(
      { ...baseRequest, pool: POOL.toUpperCase() },
      baseContext
    );
    expect(result.approved).toBe(true);
  });

  it("5 permits any pool when the pool allowlist is empty", () => {
    const result = evaluatePolicy(baseRequest, {
      ...baseContext,
      limits: { ...limits, allowedPools: [] },
    });
    expect(result.approved).toBe(true);
  });

  it("6 blocks when any action token is not allowlisted", () => {
    expect(
      deny({ tokens: [TOKEN0, "0x00000000000000000000000000000000000000ff"] })
    ).toBe("TOKEN_NOT_ALLOWED");
  });

  it("7 permits any tokens when the token allowlist is empty", () => {
    const result = evaluatePolicy(baseRequest, {
      ...baseContext,
      limits: { ...limits, allowedTokens: [] },
    });
    expect(result.approved).toBe(true);
  });

  it("8 blocks the fifth action when the daily action cap is four", () => {
    expect(deny({ actionsInLast24h: 4 })).toBe("MAX_ACTIONS_PER_DAY");
  });

  it("9 permits the fourth action when three have already run", () => {
    expect(
      evaluatePolicy({ ...baseRequest, actionsInLast24h: 3 }, baseContext).approved
    ).toBe(true);
  });

  it("10 blocks gas that would exceed the chain daily gas cap", () => {
    expect(deny({ gasSpentUsdLast24h: 49, gasCostUsd: 1.01 })).toBe(
      "MAX_DAILY_GAS"
    );
  });

  it("11 permits gas exactly at the chain daily gas cap", () => {
    expect(
      evaluatePolicy(
        { ...baseRequest, gasSpentUsdLast24h: 49, gasCostUsd: 1 },
        baseContext
      ).approved
    ).toBe(true);
  });

  it("12 blocks mainnet while MAINNET_EXECUTION_ENABLED is false", () => {
    expect(
      deny({ chainId: 1, positionMainnetEnabled: true })
    ).toBe("MAINNET_FLAG_OFF");
  });

  it("13 blocks mainnet when the position has not opted in", () => {
    expect(
      deny(
        { chainId: 1, positionMainnetEnabled: false },
        { mainnetExecutionEnabled: true }
      )
    ).toBe("MAINNET_NOT_OPTED_IN");
  });

  it("14 approves opted-in mainnet only when the global flag is on", () => {
    const result = evaluatePolicy(
      { ...baseRequest, chainId: 1, positionMainnetEnabled: true },
      { ...baseContext, mainnetExecutionEnabled: true }
    );
    expect(result.approved).toBe(true);
  });

  it("15 rejects a negative action value", () => {
    expect(deny({ usdValue: -1 })).toBe("INVALID_REQUEST");
  });

  it("16 rejects a non-finite action value", () => {
    expect(deny({ usdValue: Number.NaN })).toBe("INVALID_REQUEST");
  });

  it("17 rejects a negative gas estimate", () => {
    expect(deny({ gasCostUsd: -1 })).toBe("INVALID_REQUEST");
  });

  it("18 rejects negative counters", () => {
    expect(deny({ actionsInLast24h: -1 })).toBe("INVALID_REQUEST");
  });

  it("19 clamps every mainnet cap to the hardcoded ceiling", () => {
    const result = clampToCeiling(1, {
      maxUsdPerAction: 1_000_000,
      maxActionsPerPositionPerDay: 99_999,
      maxDailyGasUsd: 1_000_000,
    });
    expect(result.clamped).toEqual(MAINNET_POLICY_CEILING);
    expect(result.clampedFields).toHaveLength(3);
  });

  it("20 does not apply the mainnet ceiling to a testnet", () => {
    const requested = {
      maxUsdPerAction: 1_000_000,
      maxActionsPerPositionPerDay: 99_999,
      maxDailyGasUsd: 1_000_000,
    };
    expect(clampToCeiling(11155111, requested).clamped).toEqual(requested);
  });
});

// ---------------------------------------------------------------------------
// Signer selection, KMS mock, deepest flag-off refusal, and compile-time gate
// ---------------------------------------------------------------------------
class FakeSigner extends AbstractSigner {
  rawCalls = 0;
  async getAddress(): Promise<Address> {
    return "0x0000000000000000000000000000000000000001";
  }
  protected async rawSign(): Promise<Hex> {
    this.rawCalls += 1;
    return "0x01";
  }
}

const tx: TransactionSerializable = {
  chainId: 11155111,
  to: "0x0000000000000000000000000000000000000002",
  nonce: 0,
  gas: 21_000n,
  gasPrice: 1n,
  value: 0n,
  type: "legacy",
};

function approval(chainId = 11155111) {
  const result = evaluatePolicy(
    {
      ...baseRequest,
      chainId,
      positionMainnetEnabled: chainId === 1,
    },
    { ...baseContext, mainnetExecutionEnabled: chainId === 1 }
  );
  if (!result.approved) throw new Error(result.reason);
  return result.token;
}

describe("SignerService hardened path", () => {
  it("selects KMS and uses the injected KMS client", async () => {
    const getAddress = vi.fn(async () =>
      "0x0000000000000000000000000000000000000001" as Address
    );
    const signDigest = vi.fn(async () => (`0x${"11".repeat(65)}` as Hex));
    const signer = await selectSignerProvider(
      { provider: "kms", mainnetExecutionEnabled: () => false, kmsKeyId: "key" },
      { kmsClient: { getAddress, signDigest } }
    );
    expect(signer).toBeInstanceOf(KmsSigner);
    expect(await signer.getAddress(11155111)).toMatch(/^0x/);
    expect(getAddress).toHaveBeenCalledOnce();
  });

  it("selects the encrypted keystore provider", async () => {
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const signer = await selectSignerProvider(
      {
        provider: "keystore",
        mainnetExecutionEnabled: () => false,
        keystorePath: "/memory/keystore.json",
        keystorePassword: "secret",
      },
      {
        readKeystore: async () => "{}",
        decryptKeystore: async () => account,
      }
    );
    expect(signer).toBeInstanceOf(KeystoreSigner);
    expect(await signer.getAddress(11155111)).toBe(account.address);
  });

  it("refuses mainnet at the signer layer when the flag is off", async () => {
    const signer = new FakeSigner({ mainnetExecutionEnabled: () => false });
    await expect(
      signer.signTransaction(
        { ...tx, chainId: 1 },
        approval(1),
        { chainId: 1 }
      )
    ).rejects.toMatchObject({ reason: "mainnet_disabled" });
    expect(signer.rawCalls).toBe(0);
  });

  it("refuses an approval for a different chain", async () => {
    const signer = new FakeSigner({ mainnetExecutionEnabled: () => true });
    await expect(
      signer.signTransaction(tx, approval(1), { chainId: 11155111 })
    ).rejects.toBeInstanceOf(SignerRefusedError);
    expect(signer.rawCalls).toBe(0);
  });

  it("signs testnet only with a genuine PolicyEngine approval", async () => {
    const signer = new FakeSigner({ mainnetExecutionEnabled: () => false });
    await expect(
      signer.signTransaction(tx, approval(), { chainId: 11155111 })
    ).resolves.toBe("0x01");
    expect(signer.rawCalls).toBe(1);
  });

  it("requires ApprovedAction at compile time", () => {
    const signer = {} as SignerService;
    if (false) {
      // @ts-expect-error signing without a PolicyEngine ApprovedAction is illegal
      void signer.signTransaction(tx, { chainId: 11155111 });
    }
    expect(signer).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// EIP-191 owner acknowledgment
// ---------------------------------------------------------------------------
describe("mainnet acknowledgment verification", () => {
  const owner = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
  const other = privateKeyToAccount(
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  );
  const now = 1_800_000_000_000;
  const timestamp = now - 5_000;
  const message = buildMainnetAckMessage({
    positionId: "pos-mainnet",
    owner: owner.address,
    chainId: 1,
    timestamp,
  });

  it("accepts a valid fresh owner signature", async () => {
    const signature = await owner.signMessage({ message });
    await expect(
      verifyMainnetAck({
        positionId: "pos-mainnet",
        owner: owner.address,
        chainId: 1,
        message,
        signature,
        timestamp,
        now,
      })
    ).resolves.toEqual({ ok: true });
  });

  it("rejects a signature from the wrong wallet", async () => {
    const signature = await other.signMessage({ message });
    const result = await verifyMainnetAck({
      positionId: "pos-mainnet",
      owner: owner.address,
      chainId: 1,
      message,
      signature,
      timestamp,
      now,
    });
    expect(result).toMatchObject({ ok: false, code: "BAD_SIGNATURE" });
  });

  it("rejects a stale signed timestamp", async () => {
    const staleTs = now - MAINNET_ACK_MAX_AGE_MS - 1;
    const staleMessage = buildMainnetAckMessage({
      positionId: "pos-mainnet",
      owner: owner.address,
      chainId: 1,
      timestamp: staleTs,
    });
    const signature = await owner.signMessage({ message: staleMessage });
    const result = await verifyMainnetAck({
      positionId: "pos-mainnet",
      owner: owner.address,
      chainId: 1,
      message: staleMessage,
      signature,
      timestamp: staleTs,
      now,
    });
    expect(result).toMatchObject({ ok: false, code: "STALE" });
  });
});

// ---------------------------------------------------------------------------
// Guard rails + manual-resume-only invariant
// ---------------------------------------------------------------------------
describe("GuardService rails", () => {
  const safe = {
    chainId: 1,
    consecutiveSimFailures: 0,
    gasPriceGwei: 20,
    gasPauseGwei: 100,
    subgraphStatus: "ok" as const,
    rpcStatus: "ok" as const,
  };

  it("pauses after three consecutive simulation failures", () => {
    expect(
      evaluateGuard({ ...safe, consecutiveSimFailures: 3 })
    ).toMatchObject({ shouldPause: true, trigger: "consecutive_sim_failures" });
  });

  it("pauses when gas exceeds the configured family threshold", () => {
    expect(evaluateGuard({ ...safe, gasPriceGwei: 100.01 })).toMatchObject({
      shouldPause: true,
      trigger: "gas_price",
    });
  });

  it("pauses when the subgraph is down", () => {
    expect(evaluateGuard({ ...safe, subgraphStatus: "down" })).toMatchObject({
      shouldPause: true,
      trigger: "dependency_down",
    });
  });

  it("pauses when the RPC is down", () => {
    expect(evaluateGuard({ ...safe, rpcStatus: "down" })).toMatchObject({
      shouldPause: true,
      trigger: "dependency_down",
    });
  });

  it("never auto-resumes after a later healthy sample", async () => {
    const states: boolean[] = [];
    const service = new GuardService({
      pauseChain: async () => {
        states.push(false);
        return true;
      },
      getDependencyStatus: () => ({ subgraph: "ok", rpc: "ok" }),
      gasPauseGwei: () => 100,
      notify: async () => {},
      publish: () => {},
      incrementPauseMetric: () => {},
    });
    service.recordSimulation(1, false);
    service.recordSimulation(1, false);
    service.recordSimulation(1, false);
    await service.maybePauseChain({ chainId: 1, gasPriceGwei: 20 });
    service.recordSimulation(1, true);
    await service.maybePauseChain({ chainId: 1, gasPriceGwei: 20 });
    expect(states).toEqual([false]);
  });
});

// ---------------------------------------------------------------------------
// Append-only audit helper + declarative privileged-route coverage
// ---------------------------------------------------------------------------
describe("append-only audit", () => {
  it("writes immutable before/after snapshots through the Fastify helper", async () => {
    const rows: unknown[] = [];
    const writer = createAuditWriter(async (row) => {
      rows.push(Object.freeze({ ...row }));
    });
    const app = Fastify();
    await app.register(auditPlugin, { writer });
    app.decorateRequest("session", null);
    app.post("/privileged", async (req) => {
      await app.audit(req, {
        actor: "0x00000000000000000000000000000000000000aa",
        action: "policy.update",
        resource: "policy:ethereum",
        before: { maxUsdPerAction: 100 },
        after: { maxUsdPerAction: 200 },
      });
      return { ok: true };
    });
    const response = await app.inject({ method: "POST", url: "/privileged" });
    expect(response.statusCode).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "policy.update",
      resource: "policy:ethereum",
    });
    await app.close();
  });

  it.each([
    "policy.update",
    "engine.update",
    "engine.resume",
    "position.enable-mainnet",
    "strategy.update",
    "notification.update",
  ])("declares audit coverage for %s", (action) => {
    expect(PRIVILEGED_AUDIT_ACTIONS).toContain(action);
  });
});
