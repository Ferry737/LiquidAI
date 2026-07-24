// server/src/services/backtester.ts
// v1.4: Pure backtesting engine — no I/O, fully unit-testable.
//
// ASSUMPTIONS (documented honestly — do not mistake this for tick-precision):
// 1. Fee share is approximated as positionValueUsd / poolTvlUsd (capped at 50%).
//    A real Uniswap v3 position's fee share depends on its share of ACTIVE
//    liquidity around the current tick, which hourly pool data cannot give us.
//    This approximation UNDERestimates fees for narrow (concentrated) ranges
//    and roughly matches wide ranges. Comparative results between presets are
//    therefore conservative for the Aggressive preset.
// 2. Principal value uses the classic full-range IL formula relative to the
//    last rebalance anchor: lpValue = hodlValue * (1 + il(r)), where
//    il(r) = 2*sqrt(r)/(1+r) - 1 and r = price/anchorPrice. Concentrated
//    ranges amplify IL in reality; we do not model range-concavity.
// 3. While OUT of range the position earns no fees and its value is frozen at
//    the boundary composition (single-sided). We approximate "frozen" as the
//    value at the last in-range bar.
// 4. Gas costs are a flat USD estimate per action (default $3, Sepolia-ish).
//    Production would use estimateGas * gasPrice * ethUsd.
// 5. No tick-level precision anywhere — price is a scalar per hourly bar.

import type { BacktestConfig, BacktestPoint, BacktestResult } from "../../../shared/types";

/** One hour of pool data needed by the backtester. */
export interface PoolHourBar {
  ts: number; // unix ms
  price: number;
  tvlUsd: number;
  volumeUsd: number;
  feesUsd: number;
}

/** Input to the pure backtest function. */
export interface BacktestInput {
  bars: PoolHourBar[];
  initialUsd: number;
  rangeWidthPct: number;
  config: BacktestConfig;
  /** Gas cost per rebalance/compound action in USD. Default: $3. */
  gasPerActionUsd?: number;
}

/**
 * Classic impermanent-loss fraction for a 50/50 LP vs HODL.
 * il = 2*sqrt(r)/(1+r) - 1, r = price / anchorPrice. Always <= 0.
 */
export function impermanentLoss(priceRatio: number): number {
  if (priceRatio <= 0) return -1;
  return (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Run a backtest over hourly bars. Pure function: no I/O, no clock, no RNG.
 *
 * Per-step simulation:
 * - Position range [lower, upper] centered on the anchor price with total
 *   width rangeWidthPct (i.e. ±rangeWidthPct/2 around the anchor).
 * - In range: accrue estimated fees; principal follows anchorHodl*(1+IL).
 * - Out of range: no fees; principal frozen at last in-range value.
 * - Out of range for >= rebalanceAfterHrs consecutive hours: recenter range
 *   on current price (new anchor), deduct gas, count a rebalance.
 * - Unclaimed fees >= compoundMinUsd: fold fees into principal, deduct gas.
 * - stopLossIlPct set and IL vs current anchor <= -stopLossIlPct: close the
 *   position (freeze value + fees; stop simulating).
 */
export function runBacktest(input: BacktestInput): BacktestResult {
  const { bars, initialUsd, config } = input;
  const gasPerAction = input.gasPerActionUsd ?? 3;
  const halfWidthFrac = input.rangeWidthPct / 100 / 2;

  if (bars.length === 0) {
    return {
      finalValueUsd: initialUsd,
      hodlValueUsd: initialUsd,
      feesEarnedUsd: 0,
      ilUsd: 0,
      rebalanceCount: 0,
      gasSpentUsd: 0,
      netVsHodlPct: 0,
      series: [],
    };
  }

  const entryPrice = bars[0].price;
  // HODL benchmark: hold the entry composition; value scales linearly with
  // price (simplified single-asset-equivalent benchmark).
  const hodlTokens = entryPrice > 0 ? initialUsd / entryPrice : 0;

  // Anchor = last (re)balance point. Principal is valued off the anchor.
  let anchorPrice = entryPrice;
  let anchorUsd = initialUsd; // principal value at the anchor moment
  let lower = anchorPrice * (1 - halfWidthFrac);
  let upper = anchorPrice * (1 + halfWidthFrac);

  let principalUsd = initialUsd; // current marked value of the LP principal
  let unclaimedFeesUsd = 0;
  let totalFeesEarned = 0;
  let gasSpentUsd = 0;
  let rebalanceCount = 0;
  let hoursOutOfRange = 0;
  let stopped = false;

  const series: BacktestPoint[] = [];

  for (const bar of bars) {
    const price = bar.price;
    const hodlUsd = hodlTokens * price;

    if (!stopped) {
      const inRange = price >= lower && price <= upper;

      if (inRange) {
        hoursOutOfRange = 0;

        // Mark principal: anchor HODL value * (1 + IL vs anchor).
        const r = anchorPrice > 0 ? price / anchorPrice : 1;
        const anchorHodlNow = anchorUsd * r;
        principalUsd = anchorHodlNow * (1 + impermanentLoss(r));

        // Fee accrual (see assumption #1).
        const poolTvl = bar.tvlUsd > 0 ? bar.tvlUsd : 1;
        const feeShare = Math.min(0.5, principalUsd / poolTvl);
        const hourlyFees = Math.max(0, bar.feesUsd) * feeShare;
        unclaimedFeesUsd += hourlyFees;
        totalFeesEarned += hourlyFees;
      } else {
        // Out of range: no fees, value frozen (assumption #3).
        hoursOutOfRange += 1;
      }

      // Compound rule.
      if (unclaimedFeesUsd >= config.compoundMinUsd && unclaimedFeesUsd > 0) {
        principalUsd += unclaimedFeesUsd - gasPerAction;
        gasSpentUsd += gasPerAction;
        unclaimedFeesUsd = 0;
        // Compounding re-anchors the principal at the current price.
        anchorPrice = price;
        anchorUsd = principalUsd;
      }

      // Rebalance rule.
      if (!inRange && hoursOutOfRange >= config.rebalanceAfterHrs) {
        principalUsd -= gasPerAction;
        gasSpentUsd += gasPerAction;
        anchorPrice = price;
        anchorUsd = principalUsd;
        lower = price * (1 - halfWidthFrac);
        upper = price * (1 + halfWidthFrac);
        hoursOutOfRange = 0;
        rebalanceCount += 1;
      }

      // Stop-loss rule (IL measured against the current anchor).
      if (config.stopLossIlPct !== null && config.stopLossIlPct > 0) {
        const r = anchorPrice > 0 ? price / anchorPrice : 1;
        const ilPct = impermanentLoss(r) * 100;
        if (ilPct <= -config.stopLossIlPct) {
          principalUsd += unclaimedFeesUsd; // claim on close
          unclaimedFeesUsd = 0;
          stopped = true;
        }
      }
    }

    series.push({
      ts: bar.ts,
      valueUsd: round2(principalUsd + unclaimedFeesUsd),
      hodlUsd: round2(hodlUsd),
      feesCumUsd: round2(totalFeesEarned),
    });
  }

  const finalValueUsd = principalUsd + unclaimedFeesUsd;
  const hodlValueUsd = hodlTokens * bars[bars.length - 1].price;
  const ilUsd = finalValueUsd - hodlValueUsd;
  const netVsHodlPct =
    hodlValueUsd > 0 ? ((finalValueUsd - hodlValueUsd) / hodlValueUsd) * 100 : 0;

  return {
    finalValueUsd: round2(finalValueUsd),
    hodlValueUsd: round2(hodlValueUsd),
    feesEarnedUsd: round2(totalFeesEarned),
    ilUsd: round2(ilUsd),
    rebalanceCount,
    gasSpentUsd: round2(gasSpentUsd),
    netVsHodlPct: round2(netVsHodlPct),
    series,
  };
}
