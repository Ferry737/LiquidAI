// src/hooks/usePools.ts
// v1.6: chain-aware — refetches when the active chain changes.
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPools, type RankedPool } from "@/lib/api";
import { useChain } from "@/components/chain/ChainProvider";

export function usePools() {
  const { chain } = useChain();
  return useQuery<RankedPool[]>({
    queryKey: ["top-pools", chain],
    queryFn: () => fetchPools(25, chain),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
