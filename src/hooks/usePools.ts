// src/hooks/usePools.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopPools, type RankedPool } from "@/lib/subgraph";

export function usePools() {
  return useQuery<RankedPool[]>({
    queryKey: ["top-pools"],
    queryFn: () => fetchTopPools(25),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
