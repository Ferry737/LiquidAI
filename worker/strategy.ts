// worker/strategy.ts
// Re-export from the shared pure decision engine (v1.2).
// Legacy types preserved for backward compatibility.

export {
  decide,
  decideAll,
  DEFAULT_CONFIG,
  decisionToActionType,
} from "../shared/strategy";
export type {
  Decision,
  DecisionConfig,
  DecisionPosition,
} from "../shared/strategy";

// Legacy action type kept for backward compatibility with v1.1 callers.
export interface ManagedPosition {
  tokenId: number;
  pair: string;
  inRange: boolean;
  outOfRangeHours: number;
  unclaimedFeesUSD: number;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
}

// Slippage-protected minimum output helper (bps).
export function minOut(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}
