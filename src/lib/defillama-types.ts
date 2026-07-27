// src/lib/defillama-types.ts
// Shared types for the DeFiLlama Yields integration.
// These are used by the Next.js API routes (server-side) and the frontend
// client layer.

/** Raw DeFiLlama /pools entry (subset of fields we consume). */
export interface DefiLlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number | null;
  rewardTokens: string[] | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string | null;
  exposure: string | null;
  poolMeta: string | null;
  underlyingTokens: string[] | null;
  il7d: number | null;
  apyBase7d: number | null;
  apyMean30d: number | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

/** Normalized pool as served by our /api/pools endpoint. */
export interface NormalizedPool {
  id: string;
  chain: string;
  project: string;
  symbol: string;
  pair: string;
  token0Symbol: string;
  token1Symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string | null;
  exposure: string | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
  poolMeta: string | null;
}

/** Query params accepted by GET /api/pools. */
export interface PoolsQuery {
  chain?: string;
  project?: string;
  protocol?: string;
  minTvl?: number;
  maxTvl?: number;
  minApy?: number;
  maxApy?: number;
  stablecoin?: string; // "true" | "false" | "all"
  ilRisk?: string; // "no" | "yes" | "all"
  search?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: number;
}

/** Response envelope for GET /api/pools. */
export interface PoolsResponse {
  pools: NormalizedPool[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  cacheAge: number;
  fetchedAt: number;
}

/** Distinct chains/projects for filter dropdowns. */
export interface PoolsFilterOptions {
  chains: string[];
  projects: string[];
}
