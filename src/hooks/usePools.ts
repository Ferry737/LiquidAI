// src/hooks/usePools.ts
// v2.1: Fetches pools directly from the Uniswap V3 subgraph (client-side),
// with deterministic demo fallback. No backend dependency.

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopPools, type RankedPool } from "@/lib/subgraph";
import { useChain } from "@/components/chain/ChainProvider";

export function usePools() {
  const { chain } = useChain();
  return useQuery<RankedPool[]>({
    queryKey: ["top-pools", chain],
    queryFn: () => fetchTopPools(25),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
