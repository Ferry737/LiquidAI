// src/hooks/useProtocolStats.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProtocolStats, type ProtocolStats } from "@/lib/api";

export function useProtocolStats() {
  return useQuery<ProtocolStats>({
    queryKey: ["protocol-stats"],
    queryFn: fetchProtocolStats,
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}
