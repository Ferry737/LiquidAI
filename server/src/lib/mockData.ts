// server/src/lib/mockData.ts
// v1.6: Fixture data for E2E mock mode (MOCK_CHAIN=true + NODE_ENV=test ONLY).
// Deterministic per-chain fixtures so Playwright specs never need real
// wallets, subgraphs, or RPC endpoints. Never imported into decision logic —
// services check config.mockChain (which is false outside NODE_ENV=test).

import type { RankedPool, PoolDetail, ApiPosition } from "../../../shared/types";
import type { ChainSlug } from "../../../shared/chains";
import { CHAINS } from "../../../shared/chains";

function pool(
  slug: ChainSlug,
  idx: number,
  pair: [string, string],
  feeTier: number,
  tvl: number
): RankedPool {
  const id = `0x${(CHAINS[slug].chainId + idx).toString(16).padStart(40, "0")}`;
  const fees24 = tvl * 0.0004;
  return {
    id,
    pair: `${pair[0]} / ${pair[1]}`,
    token0: { id: `0x${"1".repeat(40)}`, symbol: pair[0], decimals: "18" },
    token1: { id: `0x${"2".repeat(40)}`, symbol: pair[1], decimals: "6" },
    feeTier,
    tvlUSD: tvl,
    volume24hUSD: tvl * 0.12,
    fees24hUSD: fees24,
    feeApr: tvl > 0 ? ((fees24 * 365) / tvl) * 100 : 0,
    apyBase: 14.2,
    apyReward: null,
    verifiedApy: true,
    sparkline: [12, 13.5, 14.1, 13.2, 14.8, 15.0, 14.2],
  };
}

export function mockPools(slug: ChainSlug): RankedPool[] {
  return [
    pool(slug, 1, ["WETH", "USDC"], 500, 4_200_000),
    pool(slug, 2, ["WETH", "DAI"], 3000, 1_150_000),
    pool(slug, 3, ["UNI", "WETH"], 3000, 640_000),
  ];
}

export function mockPoolDetail(slug: ChainSlug, id: string): PoolDetail | null {
  const found = mockPools(slug).find(
    (p) => p.id.toLowerCase() === id.toLowerCase()
  );
  if (!found) return null;
  const now = Math.floor(Date.now() / 1000);
  return {
    ...found,
    history7d: Array.from({ length: 7 }, (_, i) => ({
      date: now - (6 - i) * 86400,
      volumeUSD: found.volume24hUSD * (0.85 + 0.05 * i),
      feesUSD: found.fees24hUSD * (0.85 + 0.05 * i),
      tvlUSD: found.tvlUSD,
    })),
  };
}

export function mockPositions(slug: ChainSlug): ApiPosition[] {
  return [
    {
      tokenId: `${CHAINS[slug].chainId}-mock-1`,
      pair: "WETH / USDC",
      feeTier: 500,
      lowerPrice: 2900,
      upperPrice: 3400,
      currentPrice: 3180,
      liquidity: "1200000000000000000",
      valueUSD: 12450,
      unclaimedFeesUSD: 42.18,
      fees24hUSD: 8.4,
      inRange: true,
      feeApr: 24.6,
      ilPct: -0.5,
      createdAt: Date.now() - 6 * 86_400_000,
    },
  ];
}

/** Deterministic hourly bars for mock backtests (30 days, gentle sine). */
export function mockPoolHourBars(
  fromMs: number,
  toMs: number
): { ts: number; price: number; tvlUsd: number; volumeUsd: number; feesUsd: number }[] {
  const bars = [];
  const HOUR = 3_600_000;
  for (let ts = fromMs; ts <= toMs; ts += HOUR) {
    const t = (ts - fromMs) / HOUR;
    bars.push({
      ts,
      price: 3000 + 200 * Math.sin(t / 24),
      tvlUsd: 4_000_000,
      volumeUsd: 450_000,
      feesUsd: 220,
    });
  }
  return bars;
}
