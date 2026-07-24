// shared/strategy.ts
// Pure, side-effect-free strategy decision logic.
// Kept here so the worker, server services, and tests all import the same rules.

import type { StrategyActionType, StrategyActionStatus } from "./types";

/** A position evaluated by the strategy engine. */
export interface DecisionPosition {
  positionId: string;
  pair: string;
  inRange: boolean;
  outOfRangeHours: number;
  unclaimedFeesUsd: number;
  ilPct: number;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
}

/** Per-position strategy configuration. */
export interface DecisionConfig {
  enabled: boolean;
  rebalanceAfterHrs: number;
  compoundMinUsd: number;
  maxSlippagePct: number;
  stopLossIlPct: number | null;
}

export const DEFAULT_CONFIG: DecisionConfig = {
  enabled: true,
  rebalanceAfterHrs: 6,
  compoundMinUsd: 10,
  maxSlippagePct: 0.5,
  stopLossIlPct: null,
};

/** A single decision outcome. */
export interface Decision {
  positionId: string;
  type: StrategyActionType;
  reason: string;
  /** New range for REBALANCE, null otherwise. */
  newLower?: number;
  newUpper?: number;
  /** Fee amount for COMPOUND, null otherwise. */
  amountUsd?: number;
}

/**
 * Evaluate a single position against its config and return a decision.
 * Priority: disabled → stop-loss → rebalance → compound → skipped.
 */
export function decide(
  pos: DecisionPosition,
  cfg: DecisionConfig
): Decision {
  if (!cfg.enabled) {
    return {
      positionId: pos.positionId,
      type: "SKIPPED",
      reason: "strategy disabled for this position",
    };
  }

  // Rule 0: stop-loss — IL exceeded threshold, close position.
  if (cfg.stopLossIlPct !== null && cfg.stopLossIlPct > 0) {
    if (pos.ilPct <= -cfg.stopLossIlPct) {
      return {
        positionId: pos.positionId,
        type: "STOP_LOSS",
        reason: `IL ${pos.ilPct.toFixed(2)}% ≤ -${cfg.stopLossIlPct}% threshold`,
      };
    }
  }

  // Rule 1: rebalance when out-of-range beyond threshold.
  if (!pos.inRange && pos.outOfRangeHours >= cfg.rebalanceAfterHrs) {
    const width = (pos.upperPrice - pos.lowerPrice) / 2;
    return {
      positionId: pos.positionId,
      type: "REBALANCE",
      reason: `out of range ${pos.outOfRangeHours.toFixed(1)}h ≥ ${cfg.rebalanceAfterHrs}h`,
      newLower: pos.currentPrice - width,
      newUpper: pos.currentPrice + width,
    };
  }

  // Rule 2: auto-compound when unclaimed fees exceed threshold.
  if (pos.unclaimedFeesUsd >= cfg.compoundMinUsd) {
    return {
      positionId: pos.positionId,
      type: "COMPOUND",
      reason: `fees $${pos.unclaimedFeesUsd.toFixed(2)} ≥ $${cfg.compoundMinUsd}`,
      amountUsd: pos.unclaimedFeesUsd,
    };
  }

  // Rule 3: within bounds — no action needed.
  return {
    positionId: pos.positionId,
    type: "SKIPPED",
    reason: "within bounds",
  };
}

/**
 * Evaluate all positions. Each position carries its own config.
 */
export function decideAll(
  positions: { pos: DecisionPosition; cfg: DecisionConfig }[]
): Decision[] {
  return positions.map(({ pos, cfg }) => decide(pos, cfg));
}

/** Convert a Decision to a StrategyActionType + status pair for logging. */
export function decisionToActionType(
  d: Decision
): { type: StrategyActionType; status: StrategyActionStatus } {
  // The worker decides EXECUTED vs FAILED vs DRY_RUN based on on-chain result;
  // SKIPPED decisions are always logged as DRY_RUN status.
  if (d.type === "SKIPPED") {
    return { type: d.type, status: "DRY_RUN" };
  }
  return { type: d.type, status: "DRY_RUN" };
}
