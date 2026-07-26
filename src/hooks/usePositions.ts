// src/hooks/usePositions.ts
// v2.1: Reads positions from localStorage (simulated/demo positions).
// Also tries to fetch live positions from the subgraph if wallet connected.

"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useChain } from "@/components/chain/ChainProvider";
import {
  getLocalPositions,
  type LocalPosition,
} from "@/lib/local-storage";
import { DEMO_POSITIONS, toView, type PositionView } from "@/lib/positions";
import { fetchTokenPrices } from "@/lib/client-api";

export function usePositions() {
  const { address } = useAccount();
  const { chain } = useChain();

  return useQuery<PositionView[]>({
    queryKey: ["positions", address ?? "demo", chain],
    queryFn: async () => {
      // First check localStorage for user-created positions
      const localPositions = getLocalPositions();
      if (localPositions.length > 0) {
        // Update current prices from CoinGecko
        const coinId = localPositions[0]?.pair.includes("WETH")
          ? "ethereum"
          : localPositions[0]?.pair.includes("WBTC")
          ? "wrapped-bitcoin"
          : "ethereum";
        const prices = await fetchTokenPrices([coinId]);
        const currentPrice = prices[coinId] ?? 3000;

        return localPositions.map((p): PositionView => {
          const updatedPrice = p.pair.includes("BTC") ? prices["wrapped-bitcoin"] ?? currentPrice : currentPrice;
          // LocalPosition.tokenId is a string (e.g. "demo-1785037230577");
          // Position.tokenId is a number — extract digits, fall back to 0.
          const numericTokenId = (() => {
            const digits = p.tokenId.replace(/\D/g, "");
            const n = Number(digits);
            return Number.isFinite(n) ? n : 0;
          })();
          return toView({
            tokenId: numericTokenId,
            pair: p.pair,
            feeTier: p.feeTier,
            lowerPrice: p.lowerPrice,
            upperPrice: p.upperPrice,
            currentPrice: updatedPrice ?? p.currentPrice,
            valueUSD: p.valueUSD,
            unclaimedFeesUSD: p.unclaimedFeesUSD,
            fees24hUSD: p.fees24hUSD,
            entryPrice: p.entryPrice,
            createdAt: p.createdAt,
            outOfRangeSince: p.outOfRangeSince,
          });
        });
      }

      // Fall back to demo positions
      return DEMO_POSITIONS.map(toView);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export type { LocalPosition };
