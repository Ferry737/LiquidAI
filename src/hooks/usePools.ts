// src/hooks/usePools.ts
// v2.2: Fetches pools from the DeFiLlama Yields integration via Next.js API
// routes. Supports composable multi-dimensional filtering.

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchDefiLlamaPools,
  fetchPoolFilters,
  type PoolFilters,
} from "@/lib/defillama";

export function usePools(filters: PoolFilters = {}) {
  return useQuery({
    queryKey: ["pools-defillama", filters],
    queryFn: () => fetchDefiLlamaPools(filters),
    staleTime: 60_000,
    refetchInterval: 300_000, // 5 min
    placeholderData: (prev) => prev, // keep previous data during refetch
  });
}

export function usePoolFilters() {
  return useQuery({
    queryKey: ["pool-filter-options"],
    queryFn: fetchPoolFilters,
    staleTime: 5 * 60_000,
  });
}
