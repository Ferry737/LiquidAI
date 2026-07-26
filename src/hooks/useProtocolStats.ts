// src/hooks/useProtocolStats.ts
// v2.1: Fetches protocol TVL/volume from DefiLlama (client-side).

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchProtocolStatsClient,
  type ProtocolStatsClient,
} from "@/lib/client-api";

export function useProtocolStats() {
  return useQuery<ProtocolStatsClient>({
    queryKey: ["protocol-stats"],
    queryFn: fetchProtocolStatsClient,
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}
