// src/hooks/usePositions.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchPositions } from "@/lib/api";
import { DEMO_POSITIONS, toView, type PositionView } from "@/lib/positions";

// v1.1: live positions come from the backend (/api/positions/:address),
// which reads the Uniswap v3 subgraph and adds fee + IL estimates.
// A fresh testnet wallet with zero positions falls back to the deterministic
// demo set so the dashboard is never an empty shell.
export function usePositions() {
  const { address } = useAccount();

  return useQuery<PositionView[]>({
    queryKey: ["positions", address ?? "demo"],
    queryFn: async () => {
      if (address) {
        try {
          const live = await fetchPositions(address);
          if (live.length > 0) {
            return live.map(
              (p): PositionView => ({
                tokenId: Number(p.tokenId),
                pair: p.pair,
                feeTier: p.feeTier,
                lowerPrice: p.lowerPrice,
                upperPrice: p.upperPrice,
                currentPrice: p.currentPrice,
                valueUSD: p.valueUSD,
                unclaimedFeesUSD: p.unclaimedFeesUSD,
                fees24hUSD: p.fees24hUSD,
                entryPrice: (p.lowerPrice + p.upperPrice) / 2,
                createdAt: p.createdAt,
                outOfRangeSince: p.inRange ? null : p.createdAt,
                inRange: p.inRange,
                feeApr: p.feeApr,
                ilPct: p.ilPct,
                outOfRangeHours: p.inRange
                  ? 0
                  : (Date.now() - p.createdAt) / 3_600_000,
              })
            );
          }
        } catch {
          // backend unreachable — fall through to demo set
        }
      }
      return DEMO_POSITIONS.map(toView);
    },
    staleTime: 30_000,
  });
}
