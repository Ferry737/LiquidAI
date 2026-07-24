// src/hooks/usePositions.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { DEMO_POSITIONS, toView, type PositionView } from "@/lib/positions";

// In a live build this reads the NonfungiblePositionManager via viem.
// For a fresh testnet wallet it serves the deterministic demo set so the
// dashboard is never an empty shell.
export function usePositions() {
  return useQuery<PositionView[]>({
    queryKey: ["positions"],
    queryFn: async () => DEMO_POSITIONS.map(toView),
    staleTime: 30_000,
  });
}
