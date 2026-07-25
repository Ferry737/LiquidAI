// server/src/services/pools.ts
// Merges Uniswap subgraph pool data with DefiLlama yields; computes fee APR
// and the "verified APY" agreement flag.
// v1.6: chain-aware — every entry point takes a ChainSlug and uses the
// per-chain client from the ChainClientFactory.

import type {
  PoolDayPoint,
  PoolDetail,
  RankedPool,
} from "../../../shared/types";
import type { SubgraphPool } from "../clients/uniswap";
import { defiLlamaClient, type YieldPool } from "../clients/defillama";
import { chainClients } from "../lib/chainClients";
import { cache, TTL } from "../lib/cache";
import { NotFoundError, UpstreamError } from "../lib/errors";
import { config } from "../lib/config";
import { CHAINS, type ChainSlug } from "../../../shared/chains";
import { mockPools, mockPoolDetail } from "../lib/mockData";

const VERIFY_TOLERANCE = 0.15; // 15%

function normalizeSymbol(s: string): string {
  return s.toUpperCase().replace(/^WETH$/, "ETH");
}

/** Build a lookup of DefiLlama yields keyed by normalized token pair. */
function buildYieldIndex(yields: YieldPool[]): Map<string, YieldPool> {
  const index = new Map<string, YieldPool>();
  for (const y of yields) {
    const parts = y.symbol.split("-").map(normalizeSymbol);
    if (parts.length !== 2) continue;
    const key = parts.sort().join("-");
    const existing = index.get(key);
    // Keep the highest-TVL pool per pair — best liquidity proxy.
    if (!existing || y.tvlUsd > existing.tvlUsd) index.set(key, y);
  }
  return index;
}

function matchYield(
  index: Map<string, YieldPool>,
  sym0: string,
  sym1: string
): YieldPool | undefined {
  return index.get(
    [normalizeSymbol(sym0), normalizeSymbol(sym1)].sort().join("-")
  );
}

function toRankedPool(
  p: SubgraphPool,
  yieldIndex: Map<string, YieldPool>
): RankedPool {
  const tvl = Number(p.totalValueLockedUSD);
  const days = p.poolDayData ?? [];
  const vol24 = days[0] ? Number(days[0].volumeUSD) : 0;
  const fees24 = days[0] ? Number(days[0].feesUSD) : 0;
  const feeApr = tvl > 0 ? ((fees24 * 365) / tvl) * 100 : 0;

  const y = matchYield(yieldIndex, p.token0.symbol, p.token1.symbol);
  const apyBase = y?.apyBase ?? null;
  const apyReward = y?.apyReward ?? null;

  // Verified when DefiLlama base APY and our computed fee APR agree within 15%.
  const verifiedApy =
    apyBase !== null &&
    apyBase > 0 &&
    feeApr > 0 &&
    Math.abs(apyBase - feeApr) / Math.max(apyBase, feeApr) <= VERIFY_TOLERANCE;

  return {
    id: p.id,
    pair: `${p.token0.symbol} / ${p.token1.symbol}`,
    token0: p.token0,
    token1: p.token1,
    feeTier: Number(p.feeTier),
    tvlUSD: tvl,
    volume24hUSD: vol24,
    fees24hUSD: fees24,
    feeApr,
    apyBase,
    apyReward,
    verifiedApy,
    sparkline: days
      .slice()
      .reverse()
      .map((d) =>
        tvl > 0 && Number(d.volumeUSD) > 0
          ? ((Number(d.feesUSD) * 365) / tvl) * 100
          : 0
      ),
  };
}

async function getYieldIndex(chain: ChainSlug): Promise<Map<string, YieldPool>> {
  const llamaChain = CHAINS[chain].defillamaChainSlug;
  return cache.getOrSet(
    `llama:yields:index:${llamaChain}`,
    TTL.YIELDS_MS,
    async () => {
      try {
        const yields = await defiLlamaClient.uniswapYields(llamaChain);
        return buildYieldIndex(yields);
      } catch {
        // Yields are enrichment, not core data — degrade gracefully.
        return new Map<string, YieldPool>();
      }
    }
  );
}

function parseFeeTier(poolMeta: string | null | undefined): number {
  // DefiLlama poolMeta for uniswap-v3 looks like "0.05%" / "0.3%" / "1%".
  const m = poolMeta?.match(/([\d.]+)\s*%/);
  return m ? Math.round(parseFloat(m[1]) * 10_000) : 3000;
}

/**
 * Fallback when the Uniswap subgraph is unreachable (e.g. no Graph gateway
 * API key configured): build the ranked list from real DefiLlama yields data.
 * Still live external data — never mocks.
 */
async function rankedPoolsFromLlama(
  chain: ChainSlug,
  first: number
): Promise<RankedPool[]> {
  const yields = await defiLlamaClient.uniswapYields(
    CHAINS[chain].defillamaChainSlug
  );
  return yields
    .filter((y) => y.symbol.split("-").length === 2 && y.tvlUsd > 0)
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, first)
    .map((y): RankedPool => {
      const [sym0, sym1] = y.symbol.split("-");
      const feeTier = parseFeeTier(y.poolMeta);
      const vol24 = y.volumeUsd1d ?? 0;
      const fees24 = vol24 * (feeTier / 1_000_000);
      const feeApr =
        y.tvlUsd > 0 ? ((fees24 * 365) / y.tvlUsd) * 100 : 0;
      const apyBase = y.apyBase ?? null;
      const verifiedApy =
        apyBase !== null &&
        apyBase > 0 &&
        feeApr > 0 &&
        Math.abs(apyBase - feeApr) / Math.max(apyBase, feeApr) <=
          VERIFY_TOLERANCE;
      const tokens = y.underlyingTokens ?? [];
      return {
        id: y.pool,
        pair: `${sym0} / ${sym1}`,
        token0: { id: tokens[0] ?? "", symbol: sym0, decimals: "18" },
        token1: { id: tokens[1] ?? "", symbol: sym1, decimals: "18" },
        feeTier,
        tvlUSD: y.tvlUsd,
        volume24hUSD: vol24,
        fees24hUSD: fees24,
        feeApr,
        apyBase,
        apyReward: y.apyReward ?? null,
        verifiedApy,
        sparkline: [],
      };
    });
}

export async function getRankedPools(
  chain: ChainSlug,
  first = 25
): Promise<RankedPool[]> {
  if (config.mockChain) return mockPools(chain).slice(0, first);
  return cache.getOrSet(`pools:top:${chain}:${first}`, TTL.POOLS_MS, async () => {
    try {
      const [pools, yieldIndex] = await Promise.all([
        chainClients.uniswap(chain).topPools(first),
        getYieldIndex(chain),
      ]);
      return pools.map((p) => toRankedPool(p, yieldIndex));
    } catch (err) {
      if (err instanceof UpstreamError) return rankedPoolsFromLlama(chain, first);
      throw err;
    }
  });
}

export async function getPoolDetail(
  chain: ChainSlug,
  id: string
): Promise<PoolDetail> {
  if (config.mockChain) {
    const detail = mockPoolDetail(chain, id);
    if (!detail) throw new NotFoundError(`pool ${id} not found`);
    return detail;
  }
  return cache.getOrSet(`pools:detail:${chain}:${id}`, TTL.POOLS_MS, async () => {
    let pool;
    try {
      const yieldIndexP = getYieldIndex(chain);
      pool = await chainClients.uniswap(chain).poolById(id);
      if (!pool) throw new NotFoundError(`pool ${id} not found`);

      const ranked = toRankedPool(pool, await yieldIndexP);
      const history7d: PoolDayPoint[] = (pool.poolDayData ?? [])
        .slice(0, 7)
        .map((d) => ({
          date: d.date,
          volumeUSD: Number(d.volumeUSD),
          feesUSD: Number(d.feesUSD),
          tvlUSD: Number(d.tvlUSD),
        }))
        .reverse();

      return { ...ranked, history7d };
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      // Subgraph down: serve the DefiLlama-derived pool (no 7d series).
      const fallback = (await rankedPoolsFromLlama(chain, 100)).find(
        (p) => p.id.toLowerCase() === id.toLowerCase()
      );
      if (!fallback) throw new NotFoundError(`pool ${id} not found`);
      return { ...fallback, history7d: [] };
    }
  });
}
