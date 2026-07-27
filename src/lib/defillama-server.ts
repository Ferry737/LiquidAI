// src/lib/defillama-server.ts
// Server-side DeFiLlama Yields fetcher with in-memory caching.
// Runs inside Next.js API route handlers (Node.js runtime on Vercel).
//
// The /pools endpoint returns ~16k pools (~5MB). We cache for 5 minutes to
// stay well within DeFiLlama's fair-use limits and keep latency low.

import type {
  DefiLlamaPool,
  NormalizedPool,
  PoolsFilterOptions,
} from "./defillama-types";

const YIELDS_URL = "https://yields.llama.fi/pools";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  pools: NormalizedPool[];
  raw: DefiLlamaPool[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
let fetchPromise: Promise<CacheEntry> | null = null;

function normalize(raw: DefiLlamaPool): NormalizedPool {
  const parts = raw.symbol.split("-");
  const token0Symbol = parts[0] ?? raw.symbol;
  const token1Symbol = parts.length >= 2 ? parts.slice(1).join("-") : "";
  const pair =
    parts.length >= 2 ? `${token0Symbol} / ${token1Symbol}` : raw.symbol;

  return {
    id: raw.pool,
    chain: raw.chain,
    project: raw.project,
    symbol: raw.symbol,
    pair,
    token0Symbol,
    token1Symbol,
    tvlUsd: raw.tvlUsd,
    apyBase: raw.apyBase,
    apyReward: raw.apyReward,
    apy: raw.apy,
    apyPct7D: raw.apyPct7D,
    apyPct30D: raw.apyPct30D,
    stablecoin: raw.stablecoin,
    ilRisk: raw.ilRisk,
    exposure: raw.exposure,
    volumeUsd1d: raw.volumeUsd1d,
    volumeUsd7d: raw.volumeUsd7d,
    poolMeta: raw.poolMeta,
  };
}

async function fetchAndCache(): Promise<CacheEntry> {
  const res = await fetch(YIELDS_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`DeFiLlama responded ${res.status}`);
  }
  const json = (await res.json()) as {
    status: string;
    data: DefiLlamaPool[];
  };
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error("DeFiLlama returned unexpected schema");
  }
  const raw = json.data;
  const pools = raw.map(normalize);
  const entry: CacheEntry = {
    pools,
    raw,
    fetchedAt: Date.now(),
  };
  cache = entry;
  return entry;
}

/**
 * Get all normalized pools, using the in-memory cache if fresh.
 * Concurrent callers share a single fetch (deduplication).
 */
export async function getAllPools(): Promise<{
  pools: NormalizedPool[];
  fetchedAt: number;
}> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { pools: cache.pools, fetchedAt: cache.fetchedAt };
  }
  // Deduplicate concurrent requests
  if (!fetchPromise) {
    fetchPromise = fetchAndCache().finally(() => {
      fetchPromise = null;
    });
  }
  const entry = await fetchPromise;
  return { pools: entry.pools, fetchedAt: entry.fetchedAt };
}

/** Distinct chains and projects for filter dropdowns (cached alongside pools). */
export async function getFilterOptions(): Promise<PoolsFilterOptions> {
  const { pools } = await getAllPools();
  const chains = new Set<string>();
  const projects = new Set<string>();
  for (const p of pools) {
    if (p.chain) chains.add(p.chain);
    if (p.project) projects.add(p.project);
  }
  return {
    chains: Array.from(chains).sort(),
    projects: Array.from(projects).sort(),
  };
}
