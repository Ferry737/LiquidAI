// shared/policy.ts
// v1.7: Hardcoded, non-overridable spend-policy CEILINGS for mainnet chains.
//
// SECURITY: these ceilings are the absolute upper bound a PolicyConfig may set
// for a mainnet chain. The policy PUT route clamps any requested mainnet cap to
// these values (see server/src/services/policy.ts + routes/policy.ts). They
// live in /shared so the same numbers are visible to the frontend (to show the
// ceiling in the UI) and the server (to enforce it). There is NO env var or API
// path that raises them — changing a ceiling requires a code change + review.

import { isMainnetChainId } from "./chains";

/** Per-mainnet-chain hard ceilings. Testnet chains are unbounded here. */
export interface PolicyCeiling {
  /** Max USD notional per single action. */
  maxUsdPerAction: number;
  /** Max automated actions per position per rolling 24h. */
  maxActionsPerPositionPerDay: number;
  /** Max gas spend (USD) per chain per rolling 24h. */
  maxDailyGasUsd: number;
}

/**
 * Absolute mainnet ceilings. A PolicyConfig for a mainnet chain can be MORE
 * conservative than these but never looser. Deliberately low for the initial
 * mainnet rollout.
 */
export const MAINNET_POLICY_CEILING: PolicyCeiling = {
  maxUsdPerAction: 2_000,
  maxActionsPerPositionPerDay: 12,
  maxDailyGasUsd: 200,
};

/**
 * Conservative DEFAULTS seeded per mainnet chain (well under the ceiling).
 * These are what a fresh deployment starts with; an operator may tune within
 * [0, ceiling] via the audited policy route.
 */
export const MAINNET_POLICY_DEFAULT: PolicyCeiling = {
  maxUsdPerAction: 500,
  maxActionsPerPositionPerDay: 4,
  maxDailyGasUsd: 50,
};

/** Generous testnet defaults (no real value at risk). */
export const TESTNET_POLICY_DEFAULT: PolicyCeiling = {
  maxUsdPerAction: 100_000,
  maxActionsPerPositionPerDay: 100,
  maxDailyGasUsd: 10_000,
};

/**
 * Clamp a requested policy value set to the applicable ceiling. For testnet
 * chains the values pass through unchanged (still floored at 0). For mainnet
 * chains each field is clamped to [0, MAINNET_POLICY_CEILING.field].
 * Returns the clamped values plus the list of fields that were clamped.
 */
export function clampToCeiling(
  chainId: number,
  requested: PolicyCeiling
): { clamped: PolicyCeiling; clampedFields: string[] } {
  const floor0 = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
  const base: PolicyCeiling = {
    maxUsdPerAction: floor0(requested.maxUsdPerAction),
    maxActionsPerPositionPerDay: Math.floor(
      floor0(requested.maxActionsPerPositionPerDay)
    ),
    maxDailyGasUsd: floor0(requested.maxDailyGasUsd),
  };

  if (!isMainnetChainId(chainId)) {
    return { clamped: base, clampedFields: [] };
  }

  const clampedFields: string[] = [];
  const ceil = MAINNET_POLICY_CEILING;
  const out: PolicyCeiling = { ...base };

  if (out.maxUsdPerAction > ceil.maxUsdPerAction) {
    out.maxUsdPerAction = ceil.maxUsdPerAction;
    clampedFields.push("maxUsdPerAction");
  }
  if (out.maxActionsPerPositionPerDay > ceil.maxActionsPerPositionPerDay) {
    out.maxActionsPerPositionPerDay = ceil.maxActionsPerPositionPerDay;
    clampedFields.push("maxActionsPerPositionPerDay");
  }
  if (out.maxDailyGasUsd > ceil.maxDailyGasUsd) {
    out.maxDailyGasUsd = ceil.maxDailyGasUsd;
    clampedFields.push("maxDailyGasUsd");
  }

  return { clamped: out, clampedFields };
}

/** The default policy values for a chain (mainnet vs testnet). */
export function defaultPolicyForChain(chainId: number): PolicyCeiling {
  return isMainnetChainId(chainId)
    ? { ...MAINNET_POLICY_DEFAULT }
    : { ...TESTNET_POLICY_DEFAULT };
}

/** Canonical mainnet-acknowledgment message the owner must EIP-191 sign. */
export function buildMainnetAckMessage(opts: {
  positionId: string;
  owner: string;
  chainId: number;
  timestamp: number;
}): string {
  return [
    "LiquidAI — Mainnet Execution Acknowledgment",
    "",
    "I understand that enabling mainnet execution for this position allows the",
    "LiquidAI automated strategy engine to submit REAL transactions using REAL",
    "funds on a production network. I accept the associated financial risk,",
    "including impermanent loss, gas costs, and smart-contract risk.",
    "",
    `Position: ${opts.positionId}`,
    `Owner: ${opts.owner.toLowerCase()}`,
    `Chain: ${opts.chainId}`,
    `Timestamp: ${opts.timestamp}`,
  ].join("\n");
}

/** Max age (ms) of an ack timestamp before it is considered stale. */
export const MAINNET_ACK_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/** Min number of successful DRY_RUN simulations required before opt-in. */
export const MAINNET_MIN_DRY_RUNS = 10;
