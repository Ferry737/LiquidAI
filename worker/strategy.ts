// worker/strategy.ts
// Pure decision logic for the rule-based engine. Kept side-effect free so it
// is trivially testable; index.ts wires it to on-chain execution.

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

export type Action =
  | { type: "rebalance"; tokenId: number; newLower: number; newUpper: number; reason: string }
  | { type: "compound"; tokenId: number; amountUSD: number; reason: string }
  | { type: "hold"; tokenId: number; reason: string };

export interface StrategyParams {
  rebalanceAfterHours: number;
  compoundMinUsd: number;
  maxSlippageBps: number;
  killSwitch: boolean;
}

export function decide(
  positions: ManagedPosition[],
  params: StrategyParams
): Action[] {
  if (params.killSwitch) {
    return positions.map((p) => ({
      type: "hold" as const,
      tokenId: p.tokenId,
      reason: "kill switch active",
    }));
  }

  const actions: Action[] = [];
  for (const p of positions) {
    // Rule 1: rebalance when out-of-range beyond threshold.
    if (!p.inRange && p.outOfRangeHours >= params.rebalanceAfterHours) {
      const width = (p.upperPrice - p.lowerPrice) / 2;
      actions.push({
        type: "rebalance",
        tokenId: p.tokenId,
        newLower: p.currentPrice - width,
        newUpper: p.currentPrice + width,
        reason: `out of range ${p.outOfRangeHours.toFixed(1)}h ≥ ${params.rebalanceAfterHours}h`,
      });
      continue;
    }
    // Rule 2: auto-compound when unclaimed fees exceed threshold.
    if (p.unclaimedFeesUSD >= params.compoundMinUsd) {
      actions.push({
        type: "compound",
        tokenId: p.tokenId,
        amountUSD: p.unclaimedFeesUSD,
        reason: `fees $${p.unclaimedFeesUSD.toFixed(2)} ≥ $${params.compoundMinUsd}`,
      });
      continue;
    }
    actions.push({ type: "hold", tokenId: p.tokenId, reason: "within bounds" });
  }
  return actions;
}

// Slippage-protected minimum output helper (bps).
export function minOut(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}
