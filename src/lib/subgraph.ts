// src/lib/subgraph.ts
// Minimal typed client for the Uniswap v3 subgraph (Sepolia).

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/uniswap/uniswap-v3-sepolia/version/latest";

export interface PoolToken {
  id: string;
  symbol: string;
  decimals: string;
}

export interface SubgraphPool {
  id: string;
  feeTier: string;
  liquidity: string;
  token0: PoolToken;
  token1: PoolToken;
  totalValueLockedUSD: string;
  volumeUSD: string;
  poolDayData: { volumeUSD: string; feesUSD: string; date: number }[];
}

export interface RankedPool {
  id: string;
  pair: string;
  token0: PoolToken;
  token1: PoolToken;
  feeTier: number;
  tvlUSD: number;
  volume24hUSD: number;
  feeApr: number;
  sparkline: number[];
}

const POOLS_QUERY = `
  query TopPools($first: Int!) {
    pools(
      first: $first
      orderBy: totalValueLockedUSD
      orderDirection: desc
      where: { totalValueLockedUSD_gt: 0 }
    ) {
      id
      feeTier
      liquidity
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      totalValueLockedUSD
      volumeUSD
      poolDayData(first: 14, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
        date
      }
    }
  }
`;

// Deterministic fallback so the UI is fully functional without a live subgraph key.
function mockPools(): RankedPool[] {
  const defs = [
    { pair: "WETH / USDC", fee: 500, tvl: 4_250_000, vol: 1_820_000 },
    { pair: "WETH / DAI", fee: 3000, tvl: 2_140_000, vol: 610_000 },
    { pair: "UNI / WETH", fee: 3000, tvl: 980_000, vol: 240_000 },
    { pair: "USDC / DAI", fee: 100, tvl: 1_560_000, vol: 3_100_000 },
    { pair: "WETH / UNI", fee: 10000, tvl: 320_000, vol: 88_000 },
  ];
  return defs.map((d, i) => {
    const feeApr = ((d.vol * (d.fee / 1_000_000) * 365) / d.tvl) * 100;
    return {
      id: `0xmock${i.toString().padStart(38, "0")}`,
      pair: d.pair,
      token0: { id: "0x0", symbol: d.pair.split(" / ")[0], decimals: "18" },
      token1: { id: "0x1", symbol: d.pair.split(" / ")[1], decimals: "6" },
      feeTier: d.fee,
      tvlUSD: d.tvl,
      volume24hUSD: d.vol,
      feeApr,
      sparkline: Array.from({ length: 14 }, (_, k) =>
        Math.max(0, feeApr * (0.7 + 0.5 * Math.sin(k / 2 + i)))
      ),
    };
  });
}

export async function fetchTopPools(first = 25): Promise<RankedPool[]> {
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: POOLS_QUERY, variables: { first } }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`subgraph ${res.status}`);
    const json = (await res.json()) as {
      data?: { pools?: SubgraphPool[] };
      errors?: unknown;
    };
    const pools = json.data?.pools;
    if (!pools || pools.length === 0) return mockPools();

    return pools.map((p): RankedPool => {
      const tvl = Number(p.totalValueLockedUSD);
      const days = p.poolDayData ?? [];
      const vol24 = days[0] ? Number(days[0].volumeUSD) : 0;
      const fees24 = days[0] ? Number(days[0].feesUSD) : 0;
      const feeApr = tvl > 0 ? ((fees24 * 365) / tvl) * 100 : 0;
      return {
        id: p.id,
        pair: `${p.token0.symbol} / ${p.token1.symbol}`,
        token0: p.token0,
        token1: p.token1,
        feeTier: Number(p.feeTier),
        tvlUSD: tvl,
        volume24hUSD: vol24,
        feeApr,
        sparkline: days
          .slice()
          .reverse()
          .map((d) =>
            Number(d.volumeUSD) > 0 && tvl > 0
              ? ((Number(d.feesUSD) * 365) / tvl) * 100
              : 0
          ),
      };
    });
  } catch {
    return mockPools();
  }
}
