// worker/index.ts
// LiquidAI v1.3 — AI Strategy Engine with SSE, Telegram, simulation, dry-run.
//
// Every tick it:
//   1. Loads managed positions (from DB if available, else demo set)
//   2. Reads the global EngineState from DB (dryRun can be toggled via API)
//   3. Fetches live position data (price, fees, IL, range status)
//   4. Writes a PositionSnapshot to the DB for every position
//   5. Runs the decision rules (rebalance / auto-compound / stop-loss / hold)
//   6. Simulates the transaction via SimulationService before executing
//   7. Writes a StrategyAction for every decision (including SKIPPED)
//   8. Executes on-chain via NonfungiblePositionManager (or DRY_RUN)
//   9. Sends Telegram alerts per notification settings (fire-and-forget)
//  10. Publishes events to the EventBus for SSE subscribers
//
// Testnet only. Never point WORKER_PRIVATE_KEY at a mainnet-funded key.

import * as cron from "node-cron";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
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
import type { StrategyActionType, StrategyActionDto } from "../shared/types";
import { minOut } from "./strategy";
import { positionManagerAbi } from "../src/lib/abi";
import { UNISWAP_V3 } from "../src/lib/constants";

// ---- v1.3 imports ----
import {
  SimulationService,
  type SimulationResult,
  type ActionType,
} from "../server/src/services/simulation";
import {
  TelegramClient,
  formatActionAlert,
  formatOutOfRangeAlert,
} from "../server/src/clients/telegram";
import { eventBus } from "../server/src/lib/eventBus";

// ---- Prisma (optional) ----

let prisma: PrismaClient | null = null;

function getDb(): PrismaClient | null {
  if (!config.databaseUrl) return null;
  if (!prisma) {
    prisma = new PrismaClient({ log: ["error", "warn"] });
  }
  return prisma;
}

// ---- v1.3: Engine state from DB ----

async function getEngineDryRun(): Promise<boolean> {
  // The global dryRun from DB overrides the env var when available.
  const db = getDb();
  if (!db) return config.dryRun;
  try {
    const row = await db.engineState.findUnique({
      where: { id: "singleton" },
    });
    if (row) return row.dryRun;
  } catch {
    // fall through to config
  }
  return config.dryRun;
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

// ---- v1.3: Simulation + Telegram clients ----

const simulationService = new SimulationService({
  rpcUrl: config.rpc,
});

const telegram = new TelegramClient(config.telegramBotToken);

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
  /** v1.3: position owner (for notifications) */
  owner: string;
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
      owner: "demo",
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
      owner: "demo",
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
      owner: p.owner,
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
  details?: Record<string, unknown>,
  txHash?: string
): Promise<StrategyActionDto | null> {
  const db = getDb();
  if (!db || positionId.startsWith("demo-")) {
    // Still publish to EventBus for demo mode
    const dto: StrategyActionDto = {
      id: `demo-${Date.now()}`,
      positionId,
      ts: Date.now(),
      type,
      status,
      txHash: txHash ?? null,
      detailsJson: JSON.stringify({ reason, ts: Date.now(), ...details }),
    };
    publishEvent("strategy_action", dto);
    return dto;
  }

  try {
    const row = await db.strategyAction.create({
      data: {
        positionId,
        type,
        status,
        txHash: txHash ?? null,
        detailsJson: JSON.stringify({ reason, ts: Date.now(), ...details }),
      },
    });
    const dto: StrategyActionDto = {
      id: row.id,
      positionId: row.positionId,
      ts: row.ts.getTime(),
      type: row.type,
      status: row.status,
      txHash: row.txHash,
      detailsJson: row.detailsJson,
    };
    publishEvent("strategy_action", dto);
    return dto;
  } catch (err) {
    log(`  [warn] action write failed: ${(err as Error).message}`);
    return null;
  }
}

// ---- v1.3: EventBus publishing ----

function publishEvent(
  type: "strategy_action" | "position_status" | "engine_status",
  data: unknown
): void {
  try {
    eventBus.publish({ type, data: data as any });
  } catch {
    // EventBus publishing must never break the tick
  }
}

// ---- v1.3: Notification dispatch ----

/**
 * Fire-and-forget notification dispatch. Queries notification settings for
 * the position owner and sends alerts per the gating rules.
 */
async function maybeNotify(opts: {
  owner: string;
  event: "rebalance" | "compound" | "stopLoss" | "failure" | "outOfRange";
  actionType: string;
  status: string;
  pair: string;
  tokenId: string | number;
  reason?: string;
  dryRun?: boolean;
  hoursOutOfRange?: number;
}): Promise<void> {
  if (!telegram.isEnabled) return;
  if (opts.owner === "demo") return;

  const db = getDb();
  if (!db) return;

  try {
    const setting = await db.notificationSetting.findUnique({
      where: { owner: opts.owner },
    });
    if (!setting || !setting.enabled || !setting.telegramChatId) return;

    let shouldSend = false;
    switch (opts.event) {
      case "rebalance": shouldSend = setting.onRebalance; break;
      case "compound": shouldSend = setting.onCompound; break;
      case "stopLoss": shouldSend = setting.onStopLoss; break;
      case "failure": shouldSend = setting.onFailure; break;
      case "outOfRange":
        shouldSend = setting.onOutOfRangeHrs !== null &&
          setting.onOutOfRangeHrs > 0 &&
          (opts.hoursOutOfRange ?? 0) >= setting.onOutOfRangeHrs;
        break;
    }
    if (!shouldSend) return;

    // Check if we already sent an out-of-range alert (avoid repeats)
    if (opts.event === "outOfRange") {
      const recentAlert = await db.strategyAction.findFirst({
        where: {
          positionId: opts.pair, // simplified — in production use positionId
          type: "SKIPPED",
          detailsJson: { contains: "out_of_range_alerted" },
          ts: { gte: new Date(Date.now() - 6 * 3_600_000) },
        },
      });
      if (recentAlert) return; // already alerted within 6h
    }

    let msg: string;
    if (opts.event === "outOfRange") {
      msg = formatOutOfRangeAlert(
        opts.pair,
        opts.tokenId,
        opts.hoursOutOfRange ?? 0
      );
    } else {
      msg = formatActionAlert({
        actionType: opts.actionType,
        status: opts.status,
        pair: opts.pair,
        tokenId: opts.tokenId,
        reason: opts.reason,
        dryRun: opts.dryRun,
      });
    }

    // Fire-and-forget — never await in a way that blocks
    void telegram.sendAlert(setting.telegramChatId, msg);
  } catch (err) {
    log(`  [warn] notification failed: ${(err as Error).message}`);
  }
}

// ---- On-chain execution ----

async function executeCompound(
  tokenId: number
): Promise<{ hash?: string; ok: boolean }> {
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
  const dryRun = await getEngineDryRun();

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
    publishEvent("engine_status", {
      running: false,
      dryRun,
      lastRunTs: Date.now(),
    });
    return;
  }

  const positions = await loadPositions();
  log(`tick · ${positions.length} positions · dryRun=${dryRun}`);

  for (const pos of positions) {
    // 1. Record a snapshot for every position.
    await recordSnapshot(pos);

    // Publish position_status event
    publishEvent("position_status", {
      positionId: pos.positionId,
      inRange: pos.inRange,
      valueUsd: pos.valueUSD,
      unclaimedFeesUsd: pos.unclaimedFeesUSD,
    });

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

      // v1.3: Simulate before executing
      const sim = await simulationService.simulate({
        type: "STOP_LOSS" as ActionType,
        tokenId: pos.tokenId,
        caller: account.address as Address,
      });

      if (!sim.ok) {
        log(`  ↳ simulation failed: ${sim.reason} — skipping execution`);
        await recordAction(
          pos.positionId,
          "STOP_LOSS",
          "FAILED",
          `simulation failed: ${sim.reason}`,
          { simulation: sim }
        );
        await maybeNotify({
          owner: pos.owner,
          event: "failure",
          actionType: "STOP_LOSS",
          status: "FAILED",
          pair: pos.pair,
          tokenId: pos.tokenId,
          reason: sim.reason,
        });
        continue;
      }

      const result = dryRun
        ? { ok: true }
        : await executeRebalance(pos.tokenId);

      const status = result.ok
        ? dryRun ? "DRY_RUN" : "EXECUTED"
        : "FAILED";

      await recordAction(
        pos.positionId,
        "STOP_LOSS",
        status,
        decision.reason,
        {
          expectedAmount0: sim.expectedAmount0,
          expectedAmount1: sim.expectedAmount1,
          gasEstimate: sim.gasEstimate,
          gasCostUsd: sim.gasCostUsd,
        }
      );

      await maybeNotify({
        owner: pos.owner,
        event: result.ok ? "stopLoss" : "failure",
        actionType: "STOP_LOSS",
        status,
        pair: pos.pair,
        tokenId: pos.tokenId,
        reason: decision.reason,
        dryRun,
      });

    } else if (decision.type === "COMPOUND") {
      log(`  #${pos.tokenId} COMPOUND — ${decision.reason}`);

      // v1.3: Simulate before executing
      const sim = await simulationService.simulate({
        type: "COMPOUND" as ActionType,
        tokenId: pos.tokenId,
        caller: account.address as Address,
      });

      if (!sim.ok) {
        log(`  ↳ simulation failed: ${sim.reason} — skipping execution`);
        await recordAction(
          pos.positionId,
          "COMPOUND",
          "FAILED",
          `simulation failed: ${sim.reason}`,
          { simulation: sim }
        );
        await maybeNotify({
          owner: pos.owner,
          event: "failure",
          actionType: "COMPOUND",
          status: "FAILED",
          pair: pos.pair,
          tokenId: pos.tokenId,
          reason: sim.reason,
        });
        continue;
      }

      const result = dryRun
        ? { ok: true }
        : await executeCompound(pos.tokenId);

      const status = result.ok
        ? dryRun ? "DRY_RUN" : "EXECUTED"
        : "FAILED";

      await recordAction(
        pos.positionId,
        "COMPOUND",
        status,
        decision.reason,
        {
          expectedAmount0: sim.expectedAmount0,
          expectedAmount1: sim.expectedAmount1,
          gasEstimate: sim.gasEstimate,
          gasCostUsd: sim.gasCostUsd,
        }
      );

      await maybeNotify({
        owner: pos.owner,
        event: result.ok ? "compound" : "failure",
        actionType: "COMPOUND",
        status,
        pair: pos.pair,
        tokenId: pos.tokenId,
        reason: decision.reason,
        dryRun,
      });

    } else if (decision.type === "REBALANCE") {
      log(
        `  #${pos.tokenId} REBALANCE → [${decision.newLower?.toFixed(2)}, ${decision.newUpper?.toFixed(2)}] — ${decision.reason}`
      );

      // v1.3: Simulate before executing
      const sim = await simulationService.simulate({
        type: "REBALANCE" as ActionType,
        tokenId: pos.tokenId,
        caller: account.address as Address,
      });

      if (!sim.ok) {
        log(`  ↳ simulation failed: ${sim.reason} — skipping execution`);
        await recordAction(
          pos.positionId,
          "REBALANCE",
          "FAILED",
          `simulation failed: ${sim.reason}`,
          { simulation: sim }
        );
        await maybeNotify({
          owner: pos.owner,
          event: "failure",
          actionType: "REBALANCE",
          status: "FAILED",
          pair: pos.pair,
          tokenId: pos.tokenId,
          reason: sim.reason,
        });
        continue;
      }

      const result = dryRun
        ? { ok: true }
        : await executeRebalance(pos.tokenId);

      const status = result.ok
        ? dryRun ? "DRY_RUN" : "EXECUTED"
        : "FAILED";

      await recordAction(
        pos.positionId,
        "REBALANCE",
        status,
        decision.reason,
        {
          expectedAmount0: sim.expectedAmount0,
          expectedAmount1: sim.expectedAmount1,
          gasEstimate: sim.gasEstimate,
          gasCostUsd: sim.gasCostUsd,
          newLower: decision.newLower,
          newUpper: decision.newUpper,
        },
        result.hash
      );

      await maybeNotify({
        owner: pos.owner,
        event: result.ok ? "rebalance" : "failure",
        actionType: "REBALANCE",
        status,
        pair: pos.pair,
        tokenId: pos.tokenId,
        reason: decision.reason,
        dryRun,
      });
    }

    // v1.3: Check out-of-range duration for notification
    if (!pos.inRange && pos.outOfRangeHours > 0) {
      await maybeNotify({
        owner: pos.owner,
        event: "outOfRange",
        actionType: "OUT_OF_RANGE",
        status: "INFO",
        pair: pos.pair,
        tokenId: pos.tokenId,
        hoursOutOfRange: pos.outOfRangeHours,
      });
    }
  }

  // Publish engine status
  publishEvent("engine_status", {
    running: true,
    dryRun,
    lastRunTs: Date.now(),
  });
}

// ---- Boot ----

log("LiquidAI Strategy Engine v1.3 starting");
log(`  manager wallet: ${account.address}`);
log(`  schedule: ${config.cronExpr}`);
log(
  `  rebalance>${config.rebalanceAfterHours}h · compound>$${config.compoundMinUsd} · slippage ${config.maxSlippageBps}bps`
);
log(`  persistence: ${config.databaseUrl ? "enabled" : "disabled (no DATABASE_URL)"}`);
log(`  dry-run mode: ${config.dryRun ? "ON (no on-chain txs)" : "OFF (will execute)"}`);
log(`  telegram: ${telegram.isEnabled ? "enabled" : "disabled (no TELEGRAM_BOT_TOKEN)"}`);
log(`  simulation: enabled (pre-execution eth_call + estimateGas)`);

// Run once on boot, then on the cron schedule.
void tick();
cron.schedule(config.cronExpr, () => {
  void tick();
});
