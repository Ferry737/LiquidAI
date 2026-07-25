// server/src/services/historyService.ts
// v1.4: Data ingestion for backtesting — pulls Uniswap v3 subgraph poolHourDatas.
// Caches in DB (PoolHourData) so repeat backtests skip refetch.
// v1.6: chain-aware — per-chain subgraph URL from the ChainClientFactory,
// chainId on every cached row, unique key (chainId, poolId, ts).

import { z } from "zod";
import { UpstreamError } from "../lib/errors";
import { getDb, hasDatabase } from "../lib/db";
import { chainClients } from "../lib/chainClients";
import { config } from "../lib/config";
import { timeExternalCall } from "../lib/metrics";
import { healthService, subgraphDep } from "../lib/health";
import { mockPoolHourBars } from "../lib/mockData";
import { CHAINS, type ChainSlug } from "../../../shared/chains";
import type { PoolHourBar } from "./backtester";

const PoolHourDataSchema = z.object({
  pool: z.object({ id: z.string() }),
  periodStartUnix: z.number(),
  token0Price: z.string(),
  tvlUSD: z.string(),
  volumeUSD: z.string(),
  feesUSD: z.string(),
  tick: z.string().nullable().optional(),
});

const HOUR_SEC = 3600;

/**
 * Fetch hourly pool data from the chain's Uniswap v3 subgraph.
 */
async function fetchFromSubgraph(
  chain: ChainSlug,
  poolId: string,
  fromSec: number,
  toSec: number
): Promise<PoolHourBar[]> {
  const query = `
    query PoolHourData($poolId: ID!, $from: Int!, $to: Int!) {
      pool(id: $poolId) {
        poolHourData(
          first: 1000
          orderBy: periodStartUnix
          orderDirection: asc
          where: { periodStartUnix_gte: $from, periodStartUnix_lte: $to }
        ) {
          pool { id }
          periodStartUnix
          token0Price
          tvlUSD
          volumeUSD
          feesUSD
          tick
        }
      }
    }
  `;

  const subgraphUrl = chainClients.subgraphUrl(chain);
  const dep = subgraphDep(chain);

  return timeExternalCall(
    "uniswap",
    chain,
    async () => {
      let res: Response;
      try {
        res = await fetch(subgraphUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query,
            variables: { poolId: poolId.toLowerCase(), from: fromSec, to: toSec },
          }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        throw new UpstreamError(
          `uniswap-subgraph:${chain}`,
          (err as Error).message
        );
      }
      if (!res.ok)
        throw new UpstreamError(`uniswap-subgraph:${chain}`, `HTTP ${res.status}`);

      const envelope = await res.json() as { data?: { pool?: { poolHourData?: unknown[] } }; errors?: { message: string }[] };
      if (envelope.errors?.length) {
        throw new UpstreamError(
          `uniswap-subgraph:${chain}`,
          envelope.errors[0].message
        );
      }

      const raw = envelope.data?.pool?.poolHourData ?? [];
      const parsed = z.array(PoolHourDataSchema).safeParse(raw);
      if (!parsed.success) {
        throw new UpstreamError(
          `uniswap-subgraph:${chain}`,
          `schema mismatch: ${parsed.error.issues[0]?.message}`
        );
      }

      return parsed.data.map((d) => ({
        ts: d.periodStartUnix * 1000,
        price: parseFloat(d.token0Price) || 0,
        tvlUsd: parseFloat(d.tvlUSD) || 0,
        volumeUsd: parseFloat(d.volumeUSD) || 0,
        feesUsd: parseFloat(d.feesUSD) || 0,
      }));
    },
    (ok) => healthService.record(dep, ok)
  );
}

/**
 * Save pool hour data to DB (idempotent upsert), keyed by (chainId, poolId, ts).
 */
async function saveToDb(
  chain: ChainSlug,
  poolId: string,
  bars: PoolHourBar[]
): Promise<void> {
  if (!hasDatabase() || bars.length === 0) return;
  const db = getDb();
  const chainId = CHAINS[chain].chainId;
  const ops = bars.map((b) =>
    db.poolHourData.upsert({
      where: {
        chainId_poolId_ts: {
          chainId,
          poolId: poolId.toLowerCase(),
          ts: new Date(b.ts),
        },
      },
      create: {
        chainId,
        poolId: poolId.toLowerCase(),
        ts: new Date(b.ts),
        price: b.price,
        tick: 0,
        tvlUsd: b.tvlUsd,
        volumeUsd: b.volumeUsd,
        feesUsd: b.feesUsd,
      },
      update: {
        price: b.price,
        tvlUsd: b.tvlUsd,
        volumeUsd: b.volumeUsd,
        feesUsd: b.feesUsd,
      },
    })
  );
  // Batch in chunks of 50 to avoid overwhelming Prisma.
  for (let i = 0; i < ops.length; i += 50) {
    await Promise.all(ops.slice(i, i + 50));
  }
}

/**
 * Read cached pool hour data from DB for a date range.
 */
async function readFromDb(
  chain: ChainSlug,
  poolId: string,
  fromMs: number,
  toMs: number
): Promise<PoolHourBar[]> {
  if (!hasDatabase()) return [];
  const db = getDb();
  const rows = await db.poolHourData.findMany({
    where: {
      chainId: CHAINS[chain].chainId,
      poolId: poolId.toLowerCase(),
      ts: { gte: new Date(fromMs), lte: new Date(toMs) },
    },
    orderBy: { ts: "asc" },
  });
  return rows.map((r) => ({
    ts: r.ts.getTime(),
    price: r.price,
    tvlUsd: r.tvlUsd,
    volumeUsd: r.volumeUsd,
    feesUsd: r.feesUsd,
  }));
}

/**
 * Get hourly pool data, using DB cache when available and refetching missing ranges.
 * Returns sorted bars covering [from, to].
 */
export async function getPoolHourData(
  chain: ChainSlug,
  poolId: string,
  fromMs: number,
  toMs: number
): Promise<PoolHourBar[]> {
  // v1.6: E2E mock mode — deterministic fixture bars (NODE_ENV=test only).
  if (config.mockChain) return mockPoolHourBars(fromMs, toMs);

  const fromSec = Math.floor(fromMs / 1000);
  const toSec = Math.floor(toMs / 1000);

  // Try DB cache first.
  const bars = await readFromDb(chain, poolId, fromMs, toMs);

  // If we have good coverage, use it.
  if (bars.length >= Math.floor((toMs - fromMs) / (HOUR_SEC * 1000)) * 0.8) {
    return bars;
  }

  // Fetch from subgraph and cache.
  const fetched = await fetchFromSubgraph(chain, poolId, fromSec, toSec);
  await saveToDb(chain, poolId, fetched);

  // Merge: prefer DB data, fill gaps with fetched.
  const merged = await readFromDb(chain, poolId, fromMs, toMs);
  return merged.length > 0 ? merged : fetched;
}
