// server/src/services/policy.ts
// v1.7 server-side spend policy. This module is pure and is the sole authority
// capable of constructing an ApprovedAction token.

import { isMainnetChainId } from "../../../shared/chains";

/** The brand is deliberately private to this module. */
declare const APPROVAL_BRAND: unique symbol;

export interface ApprovedActionData {
  chainId: number;
  positionId: string;
  actionType: "REBALANCE" | "COMPOUND" | "STOP_LOSS";
  usdValue: number;
  gasCostUsd: number;
  pool: string;
  tokens: string[];
  approvedAt: number;
}

/** Opaque approval required by SignerService. It cannot be constructed by API code. */
export type ApprovedAction = Readonly<ApprovedActionData> & {
  readonly [APPROVAL_BRAND]: true;
};

export function readApproval(action: ApprovedAction): ApprovedActionData {
  return action;
}

export interface PolicyLimits {
  maxUsdPerAction: number;
  maxActionsPerPositionPerDay: number;
  maxDailyGasUsd: number;
  /** Address allowlist; empty means allow all. */
  allowedPools: string[];
  /** Address allowlist; empty means allow all. Every action token must pass. */
  allowedTokens: string[];
}

export interface PolicyRequest {
  chainId: number;
  positionId: string;
  actionType: "REBALANCE" | "COMPOUND" | "STOP_LOSS";
  usdValue: number;
  gasCostUsd: number;
  pool: string;
  tokens: string[];
  positionMainnetEnabled: boolean;
  actionsInLast24h: number;
  gasSpentUsdLast24h: number;
}

export interface PolicyContext {
  limits: PolicyLimits;
  mainnetExecutionEnabled: boolean;
}

export type PolicyViolationCode =
  | "INVALID_REQUEST"
  | "MAINNET_FLAG_OFF"
  | "MAINNET_NOT_OPTED_IN"
  | "MAX_USD_PER_ACTION"
  | "POOL_NOT_ALLOWED"
  | "TOKEN_NOT_ALLOWED"
  | "MAX_ACTIONS_PER_DAY"
  | "MAX_DAILY_GAS";

export type PolicyDecision =
  | { approved: true; token: ApprovedAction }
  | { approved: false; reason: string; code: PolicyViolationCode };

function blocked(code: PolicyViolationCode, reason: string): PolicyDecision {
  return { approved: false, code, reason };
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Evaluate every execution, including testnet. No I/O and no override input. */
export function evaluatePolicy(
  req: PolicyRequest,
  ctx: PolicyContext
): PolicyDecision {
  const { limits } = ctx;
  const numerics = [
    req.usdValue,
    req.gasCostUsd,
    req.actionsInLast24h,
    req.gasSpentUsdLast24h,
    limits.maxUsdPerAction,
    limits.maxActionsPerPositionPerDay,
    limits.maxDailyGasUsd,
  ];
  if (
    !Number.isInteger(req.chainId) ||
    req.chainId <= 0 ||
    !req.positionId ||
    !req.pool ||
    req.tokens.some((token) => !token) ||
    numerics.some((value) => !isFiniteNonNegative(value)) ||
    !Number.isInteger(req.actionsInLast24h) ||
    !Number.isInteger(limits.maxActionsPerPositionPerDay)
  ) {
    return blocked("INVALID_REQUEST", "policy input contains invalid or negative values");
  }

  if (isMainnetChainId(req.chainId)) {
    if (!ctx.mainnetExecutionEnabled) {
      return blocked(
        "MAINNET_FLAG_OFF",
        `mainnet execution disabled (MAINNET_EXECUTION_ENABLED=false) for chain ${req.chainId}`
      );
    }
    if (!req.positionMainnetEnabled) {
      return blocked(
        "MAINNET_NOT_OPTED_IN",
        `position ${req.positionId} has not opted in to mainnet execution`
      );
    }
  }

  if (req.usdValue > limits.maxUsdPerAction) {
    return blocked(
      "MAX_USD_PER_ACTION",
      `action USD ${req.usdValue} exceeds maxUsdPerAction ${limits.maxUsdPerAction}`
    );
  }

  const pools = limits.allowedPools.map((value) => value.toLowerCase());
  if (pools.length > 0 && !pools.includes(req.pool.toLowerCase())) {
    return blocked("POOL_NOT_ALLOWED", `pool ${req.pool} is not in the allowlist`);
  }

  const tokens = limits.allowedTokens.map((value) => value.toLowerCase());
  const disallowedToken = req.tokens.find(
    (token) => tokens.length > 0 && !tokens.includes(token.toLowerCase())
  );
  if (disallowedToken) {
    return blocked(
      "TOKEN_NOT_ALLOWED",
      `token ${disallowedToken} is not in the allowlist`
    );
  }

  if (req.actionsInLast24h + 1 > limits.maxActionsPerPositionPerDay) {
    return blocked(
      "MAX_ACTIONS_PER_DAY",
      `position ${req.positionId} would exceed maxActionsPerPositionPerDay ${limits.maxActionsPerPositionPerDay}`
    );
  }

  if (req.gasSpentUsdLast24h + req.gasCostUsd > limits.maxDailyGasUsd) {
    return blocked(
      "MAX_DAILY_GAS",
      `chain ${req.chainId} would exceed maxDailyGasUsd ${limits.maxDailyGasUsd}`
    );
  }

  const token = Object.freeze({
    chainId: req.chainId,
    positionId: req.positionId,
    actionType: req.actionType,
    usdValue: req.usdValue,
    gasCostUsd: req.gasCostUsd,
    pool: req.pool.toLowerCase(),
    tokens: req.tokens.map((value) => value.toLowerCase()),
    approvedAt: Date.now(),
  }) as ApprovedAction;
  return { approved: true, token };
}
