// shared/guards.ts
// Runtime type guards for shared API DTOs — testable in isolation.

import type {
  StrategyActionDto,
  StrategyActionStatus,
  StrategyActionType,
  StrategyConfigDto,
  PositionSnapshotDto,
} from "./types";

const ACTION_TYPES = new Set<StrategyActionType>([
  "REBALANCE",
  "COMPOUND",
  "STOP_LOSS",
  "SKIPPED",
]);

const ACTION_STATUSES = new Set<StrategyActionStatus>([
  "EXECUTED",
  "FAILED",
  "DRY_RUN",
]);

export function isStrategyActionType(v: unknown): v is StrategyActionType {
  return typeof v === "string" && ACTION_TYPES.has(v as StrategyActionType);
}

export function isStrategyActionStatus(
  v: unknown
): v is StrategyActionStatus {
  return typeof v === "string" && ACTION_STATUSES.has(v as StrategyActionStatus);
}

export function isStrategyConfigDto(v: unknown): v is StrategyConfigDto {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.positionId === "string" &&
    typeof o.enabled === "boolean" &&
    typeof o.rebalanceAfterHrs === "number" &&
    typeof o.compoundMinUsd === "number" &&
    typeof o.maxSlippagePct === "number" &&
    (o.stopLossIlPct === null || typeof o.stopLossIlPct === "number") &&
    typeof o.updatedAt === "number"
  );
}

export function isStrategyActionDto(v: unknown): v is StrategyActionDto {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.positionId === "string" &&
    typeof o.ts === "number" &&
    isStrategyActionType(o.type) &&
    isStrategyActionStatus(o.status) &&
    (o.txHash === null || typeof o.txHash === "string") &&
    typeof o.detailsJson === "string"
  );
}

export function isPositionSnapshotDto(v: unknown): v is PositionSnapshotDto {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.positionId === "string" &&
    typeof o.ts === "number" &&
    typeof o.liquidity === "string" &&
    typeof o.amount0 === "string" &&
    typeof o.amount1 === "string" &&
    typeof o.unclaimedFeesUsd === "number" &&
    typeof o.valueUsd === "number" &&
    typeof o.inRange === "boolean" &&
    typeof o.ilPct === "number"
  );
}
