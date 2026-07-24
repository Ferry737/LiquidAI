// server/src/services/positions.ts
// Positions by owner from the subgraph, enriched with fee + IL estimates.

import type { ApiPosition } from "../../../shared/types";
import { uniswapClient, type SubgraphPosition } from "../clients/uniswap";
import { cache, TTL } from "../lib/cache";

const Q96 = 2 ** 96;

function tickToPrice(tick: number, dec0: number, dec1: number): number {
  return Math.pow(1.0001, tick) * 10 ** (dec0 - dec1);
}

function sqrtPriceX96ToPrice(
  sqrtPriceX96: string,
  dec0: number,
  dec1: number
): number {
  const sp = Number(sqrtPriceX96) / Q96;
  return sp * sp * 10 ** (dec0 - dec1);
}

/** IL vs range midpoint entry, percent (negative = loss). */
function impermanentLoss(priceRatio: number): number {
  if (priceRatio <= 0) return 0;
  return ((2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1) * 100;
}

function toApiPosition(pos: SubgraphPosition): ApiPosition {
  const dec0 = Number(pos.pool.token0.decimals);
  const dec1 = Number(pos.pool.token1.decimals);

  const lowerPrice = tickToPrice(Number(pos.tickLower.tickIdx), dec0, dec1);
  const upperPrice = tickToPrice(Number(pos.tickUpper.tickIdx), dec0, dec1);
  const currentPrice =
    pos.pool.sqrtPrice && pos.pool.sqrtPrice !== "0"
      ? sqrtPriceX96ToPrice(pos.pool.sqrtPrice, dec0, dec1)
      : pos.pool.tick != null
        ? tickToPrice(Number(pos.pool.tick), dec0, dec1)
        : (lowerPrice + upperPrice) / 2;

  const poolTvl = Number(pos.pool.totalValueLockedUSD);
  const poolLiquidity = Number(pos.pool.liquidity);
  const posLiquidity = Number(pos.liquidity);
  // Share-of-liquidity estimate: fine for active in-range positions, an
  // approximation otherwise — documented as an estimate in shared types.
  const share =
    poolLiquidity > 0 ? Math.min(1, posLiquidity / poolLiquidity) : 0;
  const valueUSD = poolTvl * share;

  const day0 = pos.pool.poolDayData?.[0];
  const poolFees24h = day0 ? Number(day0.feesUSD) : 0;
  const fees24hUSD = poolFees24h * share;

  const createdAt = pos.transaction?.timestamp
    ? Number(pos.transaction.timestamp) * 1000
    : Date.now();
  const daysOpen = Math.min(7, (Date.now() - createdAt) / 86_400_000);
  const unclaimedFeesUSD = fees24hUSD * Math.max(0, daysOpen);

  const inRange = currentPrice >= lowerPrice && currentPrice <= upperPrice;
  const feeApr = valueUSD > 0 ? ((fees24hUSD * 365) / valueUSD) * 100 : 0;
  const mid = (lowerPrice + upperPrice) / 2;
  const ilPct = mid > 0 ? impermanentLoss(currentPrice / mid) : 0;

  return {
    tokenId: pos.id,
    pair: `${pos.pool.token0.symbol} / ${pos.pool.token1.symbol}`,
    feeTier: Number(pos.pool.feeTier),
    lowerPrice,
    upperPrice,
    currentPrice,
    liquidity: pos.liquidity,
    valueUSD,
    unclaimedFeesUSD,
    fees24hUSD,
    inRange,
    feeApr,
    ilPct,
    createdAt,
  };
}

export async function getPositions(address: string): Promise<ApiPosition[]> {
  const key = `positions:${address.toLowerCase()}`;
  return cache.getOrSet(key, TTL.POSITIONS_MS, async () => {
    const positions = await uniswapClient.positionsByOwner(address);
    return positions.map(toApiPosition);
  });
}
