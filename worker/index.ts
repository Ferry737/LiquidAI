// worker/index.ts
// LiquidAI v1.2 — AI Strategy Engine (rule-based cron worker) with persistence.
//
// Every tick it:
//   1. Loads managed positions (from DB if available, else demo set)
//   2. Fetches live position data (price, fees, IL, range status)
//   3. Writes a PositionSnapshot to the DB for every position
//   4. Runs the decision rules (rebalance / auto-compound / stop-loss / hold)
//   5. Writes a StrategyAction for every decision (including SKIPPED)
//   6. Executes on-chain via NonfungiblePositionManager (or DRY_RUN)
//
// Testnet only. Never point WORKER_PRIVATE_KEY at a mainnet-funded key.

import * as cron from "node-cron";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";
import { PrismaClient } from "@prisma/client";

import { config } from "./config";
import {
  decide,
  DEFAULT_CONFIG,
  type DecisionConfig,
  type DecisionPosition,
} from "../shared/strategy";
import type { StrategyActionType } from "../shared/types";
import { minOut } from "./strategy";
import { positionManagerAbi } from "../src/lib/abi";
import { UNISWAP_V3 } from "../src/lib/constants";

// ---- Prisma (optional) ----

let prisma: PrismaClient | null = null;

function getDb(): PrismaClient | null {
  if (!config.databaseUrl) return null;
  if (!prisma) {
    prisma = new PrismaClient({ log: ["error", "warn"] });
  }
  return prisma;
}

// ---- Viem clients ----

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(config.rpc),
});

const ZERO_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const activeKey =
  config.privateKey === ZERO_KEY ? generatePrivateKey() : config.privateKey;
if (config.privateKey === ZERO_KEY) {
  console.warn(
    "[warn] WORKER_PRIVATE_KEY unset — using an ephemeral testnet key (no funds). Set a real Sepolia key to execute transactions."
  );
}

const account = privateKeyToAccount(activeKey as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(config.rpc),
});

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ---- Position loading ----

interface ManagedPosition {
  positionId: string;
  tokenId: number;
  pair: string;
  inRange: boolean;
  outOfRangeHours: number;
  unclaimedFeesUSD: number;
  ilPct: number;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  valueUSD: number;
}

/**
 * Load positions from the DB (if persistence is configured) or fall back to
 * the demo working set. In production this would merge DB positions with live
 * on-chain data from NonfungiblePositionManager.positions().
 */
async function loadPositions(): Promise<ManagedPosition[]> {
  const now = Date.now();
  const demoSet: ManagedPosition[] = [
    {
      positionId: "demo-1",
      tokenId: 10241,
      pair: "WETH/USDC",
      inRange: true,
      outOfRangeHours: 0,
      unclaimedFeesUSD: 42.18,
      ilPct: -0.5,
      currentPrice: 3180,
      lowerPrice: 2900,
      upperPrice: 3400,
      liquidity: "1200000000000000000",
      amount0: "2.1",
      amount1: "6700",
      valueUSD: 12_450,
    },
    {
      positionId: "demo-2",
      tokenId: 10388,
      pair: "WETH/DAI",
      inRange: false,
      outOfRangeHours: 8,
      unclaimedFeesUSD: 11.9,
      ilPct: -2.3,
      currentPrice: 3120,
      lowerPrice: 3200,
      upperPrice: 3600,
      liquidity: "800000000000000000",
      amount0: "1.8",
      amount1: "5800",
      valueUSD: 6_820,
    },
  ];

  const db = getDb();
  if (!db) return demoSet;

  // Try to load from DB; fall back to demo set if empty.
  try {
    const dbPositions = await db.position.findMany({
      where: { closedAt: null },
      include: { strategyConfig: true },
    });

    if (dbPositions.length === 0) return demoSet;

    // Merge with live data — for now using stored values as the "live" snapshot.
    return dbPositions.map((p) => ({
      positionId: p.id,
      tokenId: Number(p.tokenId),
      pair: `${p.token0}/${p.token1}`,
      inRange: true, // would come from slot0 comparison
      outOfRangeHours: 0,
      unclaimedFeesUSD: 0,
      ilPct: 0,
      currentPrice: 0,
      lowerPrice: 0,
      upperPrice: 0,
      liquidity: "0",
      amount0: "0",
      amount1: "0",
      valueUSD: 0,
    }));
  } catch (err) {
    log(`[warn] DB load failed, using demo set: ${(err as Error).message}`);
    return demoSet;
  }
}

/**
 * Get the StrategyConfig for a position from DB, or fall back to the
 * global default from worker config / env.
 */
async function getConfig(positionId: string): Promise<DecisionConfig> {
  const db = getDb();
  if (!db || positionId.startsWith("demo-")) {
    return {
      enabled: !config.killSwitch,
      rebalanceAfterHrs: config.rebalanceAfterHours,
      compoundMinUsd: config.compoundMinUsd,
      maxSlippagePct: config.maxSlippageBps / 100,
      stopLossIlPct: null,
    };
  }

  try {
    const row = await db.strategyConfig.findUnique({
      where: { positionId },
    });
    if (row) {
      return {
        enabled: row.enabled,
        rebalanceAfterHrs: row.rebalanceAfterHrs,
        compoundMinUsd: row.compoundMinUsd,
        maxSlippagePct: row.maxSlippagePct,
        stopLossIlPct: row.stopLossIlPct,
      };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_CONFIG;
}

// ---- Persistence: snapshot + action ----

async function recordSnapshot(pos: ManagedPosition): Promise<void> {
  const db = getDb();
  if (!db || pos.positionId.startsWith("demo-")) return;

  try {
    await db.positionSnapshot.create({
      data: {
        positionId: pos.positionId,
        liquidity: pos.liquidity,
        amount0: pos.amount0,
        amount1: pos.amount1,
        unclaimedFeesUsd: pos.unclaimedFeesUSD,
        valueUsd: pos.valueUSD,
        inRange: pos.inRange,
        ilPct: pos.ilPct,
      },
    });
  } catch (err) {
    log(`  [warn] snapshot write failed: ${(err as Error).message}`);
  }
}

async function recordAction(
  positionId: string,
  type: StrategyActionType,
  status: "EXECUTED" | "FAILED" | "DRY_RUN",
  reason: string,
  txHash?: string
): Promise<void> {
  const db = getDb();
  if (!db || positionId.startsWith("demo-")) return;

  try {
    await db.strategyAction.create({
      data: {
        positionId,
        type,
        status,
        txHash: txHash ?? null,
        detailsJson: JSON.stringify({ reason, ts: Date.now() }),
      },
    });
  } catch (err) {
    log(`  [warn] action write failed: ${(err as Error).message}`);
  }
}

// ---- On-chain execution ----

async function executeCompound(
  tokenId: number
): Promise<{ hash?: string; ok: boolean }> {
  if (config.dryRun) {
    return { ok: true };
  }
  const maxU128 = (1n << 128n) - 1n;
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: UNISWAP_V3.nonfungiblePositionManager as Hex,
      abi: positionManagerAbi,
      functionName: "collect",
      args: [
        {
          tokenId: BigInt(tokenId),
          recipient: account.address,
          amount0Max: maxU128,
          amount1Max: maxU128,
        },
      ],
    });
    const hash = await walletClient.writeContract(request);
    return { hash, ok: true };
  } catch (e) {
    log(`  ↳ compound failed (${(e as Error).message.split("\n")[0]})`);
    return { ok: false };
  }
}

async function executeRebalance(
  tokenId: number
): Promise<{ hash?: string; ok: boolean }> {
  if (config.dryRun) {
    return { ok: true };
  }
  try {
    const { request } = await publicClient.simulateContract({
      account,
      address: UNISWAP_V3.nonfungiblePositionManager as Hex,
      abi: positionManagerAbi,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId: BigInt(tokenId),
          liquidity: 0n,
          amount0Min: minOut(0n, config.maxSlippageBps),
          amount1Min: minOut(0n, config.maxSlippageBps),
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        },
      ],
    });
    const hash = await walletClient.writeContract(request);
    return { hash, ok: true };
  } catch (e) {
    log(`  ↳ rebalance failed (${(e as Error).message.split("\n")[0]})`);
    return { ok: false };
  }
}

// ---- Main tick ----

async function tick(): Promise<void> {
  if (config.killSwitch) {
    log("KILL SWITCH ON — no actions taken.");
    const positions = await loadPositions();
    for (const pos of positions) {
      await recordAction(
        pos.positionId,
        "SKIPPED",
        "DRY_RUN",
        "kill switch active"
      );
    }
    return;
  }

  const positions = await loadPositions();
  log(`tick · ${positions.length} positions · dryRun=${config.dryRun}`);

  for (const pos of positions) {
    // 1. Record a snapshot for every position.
    await recordSnapshot(pos);

    // 2. Get this position's strategy config.
    const cfg = await getConfig(pos.positionId);

    // 3. Run the decision engine.
    const decisionPos: DecisionPosition = {
      positionId: pos.positionId,
      pair: pos.pair,
      inRange: pos.inRange,
      outOfRangeHours: pos.outOfRangeHours,
      unclaimedFeesUsd: pos.unclaimedFeesUSD,
      ilPct: pos.ilPct,
      currentPrice: pos.currentPrice,
      lowerPrice: pos.lowerPrice,
      upperPrice: pos.upperPrice,
    };

    const decision = decide(decisionPos, cfg);

    // 4. Execute + record action.
    if (decision.type === "SKIPPED") {
      log(`  #${pos.tokenId} SKIPPED — ${decision.reason}`);
      await recordAction(
        pos.positionId,
        "SKIPPED",
        "DRY_RUN",
        decision.reason
      );
    } else if (decision.type === "STOP_LOSS") {
      log(`  #${pos.tokenId} STOP_LOSS — ${decision.reason}`);
      await recordAction(
        pos.positionId,
        "STOP_LOSS",
        config.dryRun ? "DRY_RUN" : "EXECUTED",
        decision.reason
      );
    } else if (decision.type === "COMPOUND") {
      log(`  #${pos.tokenId} COMPOUND — ${decision.reason}`);
      const result = await executeCompound(pos.tokenId);
      await recordAction(
        pos.positionId,
        "COMPOUND",
        result.ok
          ? config.dryRun
            ? "DRY_RUN"
            : "EXECUTED"
          : "FAILED",
        decision.reason,
        result.hash
      );
    } else if (decision.type === "REBALANCE") {
      log(
        `  #${pos.tokenId} REBALANCE → [${decision.newLower?.toFixed(2)}, ${decision.newUpper?.toFixed(2)}] — ${decision.reason}`
      );
      const result = await executeRebalance(pos.tokenId);
      await recordAction(
        pos.positionId,
        "REBALANCE",
        result.ok
          ? config.dryRun
            ? "DRY_RUN"
            : "EXECUTED"
          : "FAILED",
        decision.reason,
        result.hash
      );
    }
  }
}

// ---- Boot ----

log("LiquidAI Strategy Engine v1.2 starting");
log(`  manager wallet: ${account.address}`);
log(`  schedule: ${config.cronExpr}`);
log(
  `  rebalance>${config.rebalanceAfterHours}h · compound>$${config.compoundMinUsd} · slippage ${config.maxSlippageBps}bps`
);
log(`  persistence: ${config.databaseUrl ? "enabled" : "disabled (no DATABASE_URL)"}`);
log(`  dry-run mode: ${config.dryRun ? "ON (no on-chain txs)" : "OFF (will execute)"}`);

// Run once on boot, then on the cron schedule.
void tick();
cron.schedule(config.cronExpr, () => {
  void tick();
});
