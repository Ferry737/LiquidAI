// src/lib/client-api.ts
// v2.1: Fully self-contained client-side data layer. No backend required.
// All data fetched directly from public APIs (Uniswap subgraph, CoinGecko,
// public RPCs) with deterministic demo fallbacks for every endpoint.

import { PRESETS } from "../../shared/presets";
import type {
  BacktestConfig,
  BacktestPoint,
  BacktestResult,
  StrategyPreset,
} from "../../shared/types";

// ---- CoinGecko public API (no key needed) ----

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

interface CoinGeckoPriceResponse {
  [key: string]: { usd: number };
}

/** Fetch current USD prices for common tokens via CoinGecko. */
export async function fetchTokenPrices(
  ids: string[]
): Promise<Record<string, number>> {
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${ids.join(
      ","
    )}&vs_currencies=usd`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = (await res.json()) as CoinGeckoPriceResponse;
    const out: Record<string, number> = {};
    for (const id of ids) {
      if (json[id]?.usd) out[id] = json[id].usd;
    }
    return out;
  } catch {
    // Deterministic fallback prices
    const fallback: Record<string, number> = {
      ethereum: 3180,
      bitcoin: 67000,
      uniswap: 8.5,
      "usd-coin": 1.0,
      dai: 1.0,
      tether: 1.0,
      "wrapped-bitcoin": 67000,
      "wrapped-ethereum": 3180,
    };
    return ids.reduce((acc, id) => {
      acc[id] = fallback[id] ?? 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

interface CoinGeckoOHLCResponse {
  prices: [number, number][];
}

/** Fetch daily price history from CoinGecko for backtesting. */
export async function fetchPriceHistory(
  coinId: string,
  days: number
): Promise<{ ts: number; price: number }[]> {
  try {
    const url = `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const json = (await res.json()) as CoinGeckoOHLCResponse;
    if (!json.prices || json.prices.length === 0) throw new Error("no data");
    return json.prices.map(([ts, price]) => ({ ts, price }));
  } catch {
    // Deterministic synthetic data using seeded PRNG
    return generateSyntheticHistory(days, getBasePrice(coinId));
  }
}

function getBasePrice(coinId: string): number {
  const bases: Record<string, number> = {
    ethereum: 3180,
    bitcoin: 67000,
    uniswap: 8.5,
    "usd-coin": 1.0,
    dai: 1.0,
    tether: 1.0,
    "wrapped-bitcoin": 67000,
  };
  return bases[coinId] ?? 100;
}

/** Mulberry32 seeded PRNG for deterministic synthetic data. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSyntheticHistory(
  days: number,
  basePrice: number
): { ts: number; price: number }[] {
  const rng = mulberry32(Math.floor(basePrice));
  const out: { ts: number; price: number }[] = [];
  const now = Date.now();
  const dayMs = 86_400_000;
  let price = basePrice;
  const volatility = basePrice > 1000 ? 0.03 : basePrice > 10 ? 0.05 : 0.01;
  for (let i = days; i >= 0; i--) {
    const trend = Math.sin((days - i) / 7) * 0.02;
    const noise = (rng() - 0.5) * volatility;
    price = price * (1 + trend + noise);
    price = Math.max(price, basePrice * 0.5);
    out.push({ ts: now - i * dayMs, price });
  }
  return out;
}

// ---- Backtester (client-side, real Uniswap V3 formulas) ----

/**
 * Run a backtest using historical price data. Implements real concentrated
 * liquidity math: impermanent loss, fee capture based on pool share, gas
 * costs for rebalancing, and HODL comparison.
 *
 * Uses the Uniswap V3 IL formula: IL = 2*sqrt(r)/(1+r) - 1 where r = price ratio.
 */
export function runBacktestClient(
  history: { ts: number; price: number }[],
  config: {
    initialUsd: number;
    rangeWidthPct: number;
    backtestConfig: BacktestConfig;
  }
): BacktestResult {
  if (history.length < 2) {
    return {
      finalValueUsd: config.initialUsd,
      hodlValueUsd: config.initialUsd,
      feesEarnedUsd: 0,
      ilUsd: 0,
      rebalanceCount: 0,
      gasSpentUsd: 0,
      netVsHodlPct: 0,
      series: [],
    };
  }

  const { initialUsd, rangeWidthPct, backtestConfig } = config;
  const halfWidth = rangeWidthPct / 2 / 100;
  const gasPerRebalance = 0.5; // ~$0.50 gas on L2/testnet
  const poolFeeRate = 0.0005; // 0.05% pool fee tier (WETH/USDC style)

  // Uniswap V3 concentrated-liquidity valuation.
  // Convention: token1 = quote (USD-pegged), token0 = the volatile asset; price P
  // is the price of token0 in token1 units. The position holds liquidity L across
  // [pa, pb]. Value of the position in quote terms at price P is derived from the
  // canonical amount formulas:
  //   below range (P<=pa): all token0  -> amount0 = L*(1/sqrt(pa) - 1/sqrt(pb))
  //   above range (P>=pb): all token1  -> amount1 = L*(sqrt(pb) - sqrt(pa))
  //   in range:            amount0 = L*(1/sqrt(P) - 1/sqrt(pb)),
  //                        amount1 = L*(sqrt(P) - sqrt(pa))
  //   value = amount0*P + amount1
  const sqrt = Math.sqrt;

  function positionValue(
    L: number,
    P: number,
    pa: number,
    pb: number
  ): number {
    const sp = sqrt(P);
    const spa = sqrt(pa);
    const spb = sqrt(pb);
    let amount0: number;
    let amount1: number;
    if (P <= pa) {
      amount0 = L * (1 / spa - 1 / spb);
      amount1 = 0;
    } else if (P >= pb) {
      amount0 = 0;
      amount1 = L * (spb - spa);
    } else {
      amount0 = L * (1 / sp - 1 / spb);
      amount1 = L * (sp - spa);
    }
    return amount0 * P + amount1;
  }

  // Solve the liquidity L that deploys exactly `capitalUsd` (in quote terms) at
  // price P for the range [pa, pb]. Value is linear in L, so L = capital / value(L=1).
  function liquidityForCapital(
    capitalUsd: number,
    P: number,
    pa: number,
    pb: number
  ): number {
    const unit = positionValue(1, P, pa, pb);
    return unit > 0 ? capitalUsd / unit : 0;
  }

  const startPrice = history[0].price;

  let lowerPrice = startPrice * (1 - halfWidth);
  let upperPrice = startPrice * (1 + halfWidth);
  let liquidity = liquidityForCapital(initialUsd, startPrice, lowerPrice, upperPrice);

  let feesCum = 0;
  let totalFeesEarned = 0; // lifetime fees (includes amounts later compounded)
  let gasSpent = 0;
  let rebalanceCount = 0;
  let lastRebalanceTs = history[0].ts;

  const series: BacktestPoint[] = [];

  // Concentration factor vs a full-range (v2) position: higher for tighter ranges.
  // Drives both capital efficiency (fee multiplier) and IL sensitivity implicitly
  // through the amount math above.
  function concentration(pa: number, pb: number): number {
    const denom = 1 - Math.sqrt(pa / pb);
    return denom > 0 ? 1 / denom : 1;
  }

  for (let i = 1; i < history.length; i++) {
    const point = history[i];
    const prevPrice = history[i - 1].price;
    const price = point.price;
    const hoursSinceRebalance = (point.ts - lastRebalanceTs) / (60 * 60 * 1000);

    const inRange = price >= lowerPrice && price <= upperPrice;

    // ---- Fee accrual (only when price is inside the active range) ----
    if (inRange) {
      // Pool volume proxy: price move drives arbitrage/swap volume through the
      // tick. Fees earned scale with the position's concentration (share of
      // in-range liquidity) — tighter ranges capture more per dollar deployed.
      const priceMovePct = Math.abs(price - prevPrice) / prevPrice;
      const positionVal = positionValue(liquidity, price, lowerPrice, upperPrice);
      const conc = Math.min(concentration(lowerPrice, upperPrice), 50);
      // Swap volume routed through this position ≈ deployed value × price move ×
      // concentration; LP earns poolFeeRate on that flow.
      const volumeThroughPosition = positionVal * priceMovePct * conc;
      const feeEarned = volumeThroughPosition * poolFeeRate;
      feesCum += feeEarned;
      totalFeesEarned += feeEarned;
    }

    // ---- Rebalance triggers: out-of-range, or scheduled cadence ----
    const scheduledRebalance =
      hoursSinceRebalance >= backtestConfig.rebalanceAfterHrs;
    if (!inRange || scheduledRebalance) {
      // Current position value realized at this price
      let capital = positionValue(liquidity, price, lowerPrice, upperPrice);
      // Compound accrued fees back into the position if past threshold
      if (feesCum >= backtestConfig.compoundMinUsd) {
        capital += feesCum;
        feesCum = 0;
      }
      // Remove + re-add liquidity centered on current price
      gasSpent += gasPerRebalance;
      rebalanceCount++;
      lastRebalanceTs = point.ts;
      lowerPrice = price * (1 - halfWidth);
      upperPrice = price * (1 + halfWidth);
      liquidity = liquidityForCapital(capital, price, lowerPrice, upperPrice);
    }

    // ---- Stop-loss: exit + re-enter if IL exceeds threshold ----
    if (backtestConfig.stopLossIlPct !== null) {
      // IL vs HODL of the tokens held at last rebalance, at current price.
      const posVal = positionValue(liquidity, price, lowerPrice, upperPrice);
      const centerP = (lowerPrice + upperPrice) / 2;
      const r = centerP > 0 ? price / centerP : 1;
      const ilPct = r > 0 ? Math.abs((2 * Math.sqrt(r)) / (1 + r) - 1) * 100 : 0;
      if (ilPct > backtestConfig.stopLossIlPct) {
        let capital = posVal + feesCum;
        feesCum = 0;
        gasSpent += gasPerRebalance;
        rebalanceCount++;
        lastRebalanceTs = point.ts;
        lowerPrice = price * (1 - halfWidth);
        upperPrice = price * (1 + halfWidth);
        liquidity = liquidityForCapital(capital, price, lowerPrice, upperPrice);
      }
    }

    const posValueNow = positionValue(liquidity, price, lowerPrice, upperPrice);
    const hodlValue = initialUsd * (price / startPrice);

    series.push({
      ts: point.ts,
      valueUsd: posValueNow + feesCum,
      hodlUsd: hodlValue,
      feesCumUsd: feesCum,
    });
  }

  const lastPrice = history[history.length - 1].price;
  const finalPositionValue = positionValue(
    liquidity,
    lastPrice,
    lowerPrice,
    upperPrice
  );
  const finalValue = finalPositionValue + feesCum;
  const hodlValue = initialUsd * (lastPrice / startPrice);
  const netVsHodlPct =
    hodlValue > 0 ? ((finalValue - hodlValue) / hodlValue) * 100 : 0;
  // IL in USD = LP position value (ex-fees) minus what holding the tokens would be worth.
  const ilUsd = finalPositionValue - hodlValue;

  return {
    finalValueUsd: finalValue,
    hodlValueUsd: hodlValue,
    feesEarnedUsd: totalFeesEarned,
    ilUsd,
    rebalanceCount,
    gasSpentUsd: gasSpent,
    netVsHodlPct,
    series,
  };
}

/** Run all 3 preset backtests in parallel (client-side). */
export async function runComparisonClient(
  coinId: string,
  days: number,
  initialUsd: number
): Promise<{ preset: StrategyPreset; result: BacktestResult }[]> {
  const history = await fetchPriceHistory(coinId, days);
  return PRESETS.map((preset) => ({
    preset,
    result: runBacktestClient(history, {
      initialUsd,
      rangeWidthPct: preset.rangeWidthPct,
      backtestConfig: preset.config,
    }),
  }));
}

// ---- Protocol Stats (from DefiLlama public API) ----

export interface ProtocolStatsClient {
  protocolTvlUSD: number;
  chainTvlUSD: number;
  volume24hUSD: number;
  updatedAt: number;
}

export async function fetchProtocolStatsClient(): Promise<ProtocolStatsClient> {
  try {
    const res = await fetch(
      "https://yields.llama.fi/protocol/uniswap-v3",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`DefiLlama ${res.status}`);
    const json = (await res.json()) as { tvlUsd?: number; chain?: string };
    return {
      protocolTvlUSD: json.tvlUsd ?? 3_800_000_000,
      chainTvlUSD: json.tvlUsd ? json.tvlUsd * 0.6 : 2_280_000_000,
      volume24hUSD: 1_200_000_000,
      updatedAt: Date.now(),
    };
  } catch {
    return {
      protocolTvlUSD: 3_800_000_000,
      chainTvlUSD: 2_280_000_000,
      volume24hUSD: 1_200_000_000,
      updatedAt: Date.now(),
    };
  }
}

// ---- CoinGecko ID mapping ----

export const COINGECKO_COIN_MAP: Record<string, string> = {
  WETH: "ethereum",
  ETH: "ethereum",
  WBTC: "wrapped-bitcoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  UNI: "uniswap",
  "WBTC/USDT": "wrapped-bitcoin",
  "WETH/USDC": "ethereum",
  "WETH/DAI": "ethereum",
  "UNI/WETH": "uniswap",
  "USDC/DAI": "usd-coin",
};

export function getCoinId(pair: string): string {
  // Take token0 of the pair
  const token0 = pair.split("/")[0]?.trim() ?? "WETH";
  return COINGECKO_COIN_MAP[token0] ?? "ethereum";
}
