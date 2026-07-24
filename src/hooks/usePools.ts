// src/hooks/usePools.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPools, type RankedPool } from "@/lib/api";

export function usePools() {
  return useQuery<RankedPool[]>({
    queryKey: ["top-pools"],
    queryFn: () => fetchPools(25),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
