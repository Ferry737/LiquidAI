// shared/types.ts
// Single source of truth for API contracts shared by /server and the Next.js app.

export interface PoolToken {
  id: string;
  symbol: string;
  decimals: string;
}

export interface RankedPool {
  id: string;
  pair: string;
  token0: PoolToken;
  token1: PoolToken;
  feeTier: number;
  tvlUSD: number;
  volume24hUSD: number;
  fees24hUSD: number;
  /** Fee APR computed from 24h fees vs TVL, percent. */
  feeApr: number;
  /** DefiLlama base APY (fees), percent, when a matching yields pool exists. */
  apyBase: number | null;
  /** DefiLlama reward APY, percent. */
  apyReward: number | null;
  /** True when DefiLlama apyBase and computed feeApr agree within 15%. */
  verifiedApy: boolean;
  sparkline: number[];
}

export interface PoolDayPoint {
  /** Unix seconds (subgraph day bucket). */
  date: number;
  volumeUSD: number;
  feesUSD: number;
  tvlUSD: number;
}

export interface PoolDetail extends RankedPool {
  history7d: PoolDayPoint[];
}

export interface ProtocolStats {
  /** Uniswap v3 TVL across chains (DefiLlama). */
  protocolTvlUSD: number;
  /** Ethereum chain TVL (DefiLlama). */
  chainTvlUSD: number;
  /** Uniswap 24h DEX volume (DefiLlama). */
  volume24hUSD: number;
  updatedAt: number;
}

export interface ApiPosition {
  tokenId: string;
  pair: string;
  feeTier: number;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  liquidity: string;
  /** Estimated from the position's share of pool liquidity. */
  valueUSD: number;
  /** Estimate: 24h pool fees x share x days since mint (capped at 7d). */
  unclaimedFeesUSD: number;
  fees24hUSD: number;
  inRange: boolean;
  feeApr: number;
  /** IL estimate vs range midpoint, percent (negative = loss). */
  ilPct: number;
  /** Unix ms of the mint transaction. */
  createdAt: number;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  ts: number;
}
