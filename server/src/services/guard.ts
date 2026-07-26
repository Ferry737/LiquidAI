// server/src/services/guard.ts
// Automatic per-chain safety rails. The service may pause, but never resumes;
// resume is available only through the authenticated, audited engine route.

import { chainByIdAny } from "../../../shared/chains";
import { eventBus } from "../lib/eventBus";
import { enginePausesTotal } from "../lib/metrics";
import {
  getNotificationChatIds,
  setChainEngineState,
} from "../lib/repo";
import {
  healthService,
  rpcDep,
  subgraphDep,
  type DependencyStatus,
} from "../lib/health";
import { TelegramClient } from "../clients/telegram";
import { config, gasPauseGweiForChain } from "../lib/config";

export const CONSECUTIVE_SIM_FAILURE_THRESHOLD = 3;

export type GuardTrigger =
  | "consecutive_sim_failures"
  | "gas_price"
  | "dependency_down";

export interface GuardInputs {
  chainId: number;
  consecutiveSimFailures: number;
  gasPriceGwei: number;
  gasPauseGwei: number;
  subgraphStatus: DependencyStatus;
  rpcStatus: DependencyStatus;
}

export interface GuardDecision {
  shouldPause: boolean;
  trigger: GuardTrigger | null;
  reason: string | null;
}

export function evaluateGuard(inputs: GuardInputs): GuardDecision {
  if (inputs.consecutiveSimFailures >= CONSECUTIVE_SIM_FAILURE_THRESHOLD) {
    return {
      shouldPause: true,
      trigger: "consecutive_sim_failures",
      reason: `${inputs.consecutiveSimFailures} consecutive failed simulations`,
    };
  }
  if (inputs.gasPriceGwei > inputs.gasPauseGwei) {
    return {
      shouldPause: true,
      trigger: "gas_price",
      reason: `gas price ${inputs.gasPriceGwei} gwei exceeds ${inputs.gasPauseGwei} gwei`,
    };
  }
  if (inputs.subgraphStatus === "down" || inputs.rpcStatus === "down") {
    const dependencies = [
      inputs.subgraphStatus === "down" ? "subgraph" : null,
      inputs.rpcStatus === "down" ? "RPC" : null,
    ].filter(Boolean);
    return {
      shouldPause: true,
      trigger: "dependency_down",
      reason: `${dependencies.join(" and ")} health is down`,
    };
  }
  return { shouldPause: false, trigger: null, reason: null };
}

export interface GuardServiceDependencies {
  /** Must atomically persist a pause; true means state changed running->paused. */
  pauseChain: (chainId: number, reason: string) => Promise<boolean>;
  getDependencyStatus: (chainId: number) => {
    subgraph: DependencyStatus;
    rpc: DependencyStatus;
  };
  gasPauseGwei: (chainId: number) => number;
  notify: (chainId: number, message: string) => Promise<void>;
  publish: (chainId: number, reason: string) => void;
  incrementPauseMetric: (chainId: number, reason: GuardTrigger) => void;
}

function productionDependencies(): GuardServiceDependencies {
  const telegram = new TelegramClient(config.TELEGRAM_BOT_TOKEN);
  return {
    pauseChain: async (chainId, reason) => {
      const { before } = await setChainEngineState(chainId, false, reason);
      return before.running;
    },
    getDependencyStatus: (chainId) => {
      const slug = chainByIdAny(chainId)?.slug ?? String(chainId);
      return {
        subgraph: healthService.snapshot(subgraphDep(slug)).status,
        rpc: healthService.snapshot(rpcDep(slug)).status,
      };
    },
    gasPauseGwei: gasPauseGweiForChain,
    notify: async (_chainId, message) => {
      if (!telegram.isEnabled) return;
      const chatIds = await getNotificationChatIds();
      await Promise.allSettled(
        chatIds.map((chatId) => telegram.sendAlert(chatId, message))
      );
    },
    publish: (chainId, reason) => {
      eventBus.publish({
        type: "engine_status",
        data: {
          running: false,
          dryRun: true,
          lastRunTs: Date.now(),
          chainId,
          reason,
        },
      });
    },
    incrementPauseMetric: (chainId, reason) => {
      enginePausesTotal.inc({
        chain: chainByIdAny(chainId)?.slug ?? String(chainId),
        reason,
      });
    },
  };
}

export class GuardService {
  private readonly failures = new Map<number, number>();
  private readonly pausedInProcess = new Set<number>();
  private readonly dependencies: GuardServiceDependencies;

  constructor(dependencies?: Partial<GuardServiceDependencies>) {
    this.dependencies = { ...productionDependencies(), ...dependencies };
  }

  recordSimulation(chainId: number, ok: boolean): number {
    const next = ok ? 0 : (this.failures.get(chainId) ?? 0) + 1;
    this.failures.set(chainId, next);
    return next;
  }

  consecutiveFailuresFor(chainId: number): number {
    return this.failures.get(chainId) ?? 0;
  }

  async maybePauseChain(opts: {
    chainId: number;
    gasPriceGwei: number;
  }): Promise<GuardDecision> {
    const dependency = this.dependencies.getDependencyStatus(opts.chainId);
    const decision = evaluateGuard({
      chainId: opts.chainId,
      consecutiveSimFailures: this.consecutiveFailuresFor(opts.chainId),
      gasPriceGwei: opts.gasPriceGwei,
      gasPauseGwei: this.dependencies.gasPauseGwei(opts.chainId),
      subgraphStatus: dependency.subgraph,
      rpcStatus: dependency.rpc,
    });
    if (!decision.shouldPause || !decision.trigger || !decision.reason) {
      return decision;
    }

    // A healthy later sample can clear counters, but there is intentionally no
    // code here that sets running=true. Manual route only.
    if (this.pausedInProcess.has(opts.chainId)) return decision;
    const changed = await this.dependencies.pauseChain(
      opts.chainId,
      decision.reason
    );
    this.pausedInProcess.add(opts.chainId);
    if (!changed) return decision;

    this.dependencies.incrementPauseMetric(opts.chainId, decision.trigger);
    this.dependencies.publish(opts.chainId, decision.reason);
    const chain = chainByIdAny(opts.chainId);
    await this.dependencies.notify(
      opts.chainId,
      `⛔ LiquidAI auto-paused ${chain?.name ?? opts.chainId}\nReason: ${decision.reason}\nResume is manual only.`
    );
    return decision;
  }
}

export const guardService = new GuardService();
