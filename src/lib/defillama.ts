// src/lib/defillama.ts
// Client-side fetch layer for the DeFiLlama-powered /api/pools endpoints.
// Calls the Next.js same-origin API routes (which proxy + cache DeFiLlama).

import type {
  NormalizedPool,
  PoolsResponse,
  PoolsFilterOptions,
} from "./defillama-types";

export type { NormalizedPool, PoolsResponse, PoolsFilterOptions } from "./defillama-types";

export interface PoolFilters {
  chain?: string;
  project?: string;
  minTvl?: number;
  maxTvl?: number;
  minApy?: number;
  maxApy?: number;
  stablecoin?: "true" | "false" | "all";
  ilRisk?: "no" | "yes" | "all";
  search?: string;
  sort?: "tvl" | "apy" | "volume" | "apy7d";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/** Build a query string from filter parameters. */
function buildQuery(filters: PoolFilters): string {
  const params = new URLSearchParams();
  if (filters.chain && filters.chain !== "all")
    params.set("chain", filters.chain);
  if (filters.project && filters.project !== "all")
    params.set("project", filters.project);
  if (filters.minTvl !== undefined)
    params.set("minTvl", String(filters.minTvl));
  if (filters.maxTvl !== undefined)
    params.set("maxTvl", String(filters.maxTvl));
  if (filters.minApy !== undefined)
    params.set("minApy", String(filters.minApy));
  if (filters.maxApy !== undefined)
    params.set("maxApy", String(filters.maxApy));
  if (filters.stablecoin && filters.stablecoin !== "all")
    params.set("stablecoin", filters.stablecoin);
  if (filters.ilRisk && filters.ilRisk !== "all")
    params.set("ilRisk", filters.ilRisk);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Fetch pools with optional filtering, sorting, and pagination. */
export async function fetchDefiLlamaPools(
  filters: PoolFilters = {}
): Promise<PoolsResponse> {
  const qs = buildQuery(filters);
  const res = await fetch(`/api/pools${qs}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch pools: ${res.status}`);
  }
  return (await res.json()) as PoolsResponse;
}

/** Fetch distinct chains and projects for filter dropdowns. */
export async function fetchPoolFilters(): Promise<PoolsFilterOptions> {
  const res = await fetch(`/api/pools/filters`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch filter options: ${res.status}`);
  }
  return (await res.json()) as PoolsFilterOptions;
}

/** Fetch a single pool by ID. */
export async function fetchPoolById(id: string): Promise<NormalizedPool> {
  const res = await fetch(`/api/pools/${encodeURIComponent(id)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch pool: ${res.status}`);
  }
  return (await res.json()) as NormalizedPool;
}
