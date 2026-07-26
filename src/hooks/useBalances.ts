// src/hooks/useBalances.ts
// v2.1: Fetches native + ERC-20 token balances using wagmi/viem directly
// from the connected chain's public RPC. No backend dependency.

"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, type Address } from "viem";
import { TOKENS } from "@/lib/constants";

export interface TokenBalance {
  symbol: string;
  address: string;
  balance: bigint;
  formatted: string;
  decimals: number;
  usdValue: number | null;
}

export interface BalanceSummary {
  native: {
    symbol: string;
    balance: bigint;
    formatted: string;
    usdValue: number | null;
  };
  tokens: TokenBalance[];
  totalUsd: number;
}

export function useBalances() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  return useQuery<BalanceSummary | null>({
    queryKey: ["balances", address],
    queryFn: async () => {
      if (!address || !isConnected || !publicClient) return null;

      // Fetch native balance
      const nativeBalance = await publicClient.getBalance({
        address: address as Address,
      });

      // Fetch ERC-20 balances using raw eth_call (avoids viem type issues)
      const balanceOfSelector = "0x70a08231"; // balanceOf(address)
      const paddedAddress = address.toLowerCase().slice(2).padStart(64, "0");

      const tokenBalances = await Promise.all(
        TOKENS.map(async (token) => {
          try {
            const data = await publicClient.call({
              to: token.address as Address,
              data: `${balanceOfSelector}${paddedAddress}` as `0x${string}`,
            });
            const balance =
              data?.data && data.data !== "0x"
                ? BigInt(data.data)
                : BigInt(0);
            return {
              symbol: token.symbol,
              address: token.address,
              balance,
              formatted: formatUnits(balance, token.decimals),
              decimals: token.decimals,
              usdValue: null as number | null,
            };
          } catch {
            return {
              symbol: token.symbol,
              address: token.address,
              balance: BigInt(0),
              formatted: "0",
              decimals: token.decimals,
              usdValue: null as number | null,
            };
          }
        })
      );

      // Try to fetch USD prices from CoinGecko
      try {
        const coinIds = ["ethereum", "usd-coin", "uniswap", "dai"];
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(
            ","
          )}&vs_currencies=usd`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const prices = (await res.json()) as Record<
            string,
            { usd: number }
          >;
          const priceMap: Record<string, number> = {
            WETH: prices["ethereum"]?.usd ?? 3180,
            ETH: prices["ethereum"]?.usd ?? 3180,
            USDC: prices["usd-coin"]?.usd ?? 1,
            UNI: prices["uniswap"]?.usd ?? 8.5,
            DAI: prices["dai"]?.usd ?? 1,
          };

          const nativeUsd =
            Number(formatUnits(nativeBalance, 18)) *
            (priceMap["ETH"] ?? 3180);
          tokenBalances.forEach((tb) => {
            const price = priceMap[tb.symbol];
            if (price) {
              tb.usdValue = Number(tb.formatted) * price;
            }
          });

          const tokenTotal = tokenBalances.reduce(
            (sum, tb) => sum + (tb.usdValue ?? 0),
            0
          );

          return {
            native: {
              symbol: "ETH",
              balance: nativeBalance,
              formatted: formatUnits(nativeBalance, 18),
              usdValue: nativeUsd,
            },
            tokens: tokenBalances,
            totalUsd: nativeUsd + tokenTotal,
          };
        }
      } catch {
        // Price fetch failed — return balances without USD values
      }

      return {
        native: {
          symbol: "ETH",
          balance: nativeBalance,
          formatted: formatUnits(nativeBalance, 18),
          usdValue: null,
        },
        tokens: tokenBalances,
        totalUsd: 0,
      };
    },
    enabled: !!address && isConnected,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
