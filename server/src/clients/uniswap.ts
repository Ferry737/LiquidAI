// server/src/clients/uniswap.ts
// Uniswap v3 subgraph GraphQL client. Every response is zod-validated.

import { z } from "zod";
import { config } from "../lib/config";
import { UpstreamError } from "../lib/errors";

const TokenSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  decimals: z.string(),
});

const PoolDayDataSchema = z.object({
  date: z.number(),
  volumeUSD: z.string(),
  feesUSD: z.string(),
  tvlUSD: z.string().optional().default("0"),
});

const PoolSchema = z.object({
  id: z.string(),
  feeTier: z.string(),
  liquidity: z.string(),
  token0: TokenSchema,
  token1: TokenSchema,
  totalValueLockedUSD: z.string(),
  volumeUSD: z.string(),
  poolDayData: z.array(PoolDayDataSchema).default([]),
});

const PositionSchema = z.object({
  id: z.string(),
  liquidity: z.string(),
  tickLower: z.object({ tickIdx: z.string() }),
  tickUpper: z.object({ tickIdx: z.string() }),
  depositedToken0: z.string(),
  depositedToken1: z.string(),
  transaction: z.object({ timestamp: z.string() }).nullable().optional(),
  pool: PoolSchema.extend({
    tick: z.string().nullable().optional(),
    sqrtPrice: z.string().optional().default("0"),
  }),
});

export type SubgraphPool = z.infer<typeof PoolSchema>;
export type SubgraphPosition = z.infer<typeof PositionSchema>;

const GraphQLEnvelope = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

async function gql<S extends z.ZodTypeAny>(
  query: string,
  variables: Record<string, unknown>,
  dataSchema: S
): Promise<z.output<S>> {
  let res: Response;
  try {
    res = await fetch(config.SUBGRAPH_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new UpstreamError("uniswap-subgraph", (err as Error).message);
  }
  if (!res.ok) {
    throw new UpstreamError("uniswap-subgraph", `HTTP ${res.status}`);
  }
  const envelope = GraphQLEnvelope.parse(await res.json());
  if (envelope.errors?.length) {
    throw new UpstreamError("uniswap-subgraph", envelope.errors[0].message);
  }
  const parsed = dataSchema.safeParse(envelope.data);
  if (!parsed.success) {
    throw new UpstreamError(
      "uniswap-subgraph",
      `schema mismatch: ${parsed.error.issues[0]?.message ?? "unknown"}`
    );
  }
  return parsed.data;
}

const TOP_POOLS_QUERY = `
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
        date
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;

const POOL_DETAIL_QUERY = `
  query PoolDetail($id: ID!) {
    pool(id: $id) {
      id
      feeTier
      liquidity
      token0 { id symbol decimals }
      token1 { id symbol decimals }
      totalValueLockedUSD
      volumeUSD
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        date
        volumeUSD
        feesUSD
        tvlUSD
      }
    }
  }
`;

const POSITIONS_QUERY = `
  query Positions($owner: String!) {
    positions(first: 50, where: { owner: $owner, liquidity_gt: 0 }) {
      id
      liquidity
      tickLower { tickIdx }
      tickUpper { tickIdx }
      depositedToken0
      depositedToken1
      transaction { timestamp }
      pool {
        id
        feeTier
        liquidity
        tick
        sqrtPrice
        token0 { id symbol decimals }
        token1 { id symbol decimals }
        totalValueLockedUSD
        volumeUSD
        poolDayData(first: 1, orderBy: date, orderDirection: desc) {
          date
          volumeUSD
          feesUSD
          tvlUSD
        }
      }
    }
  }
`;

export class UniswapClient {
  async topPools(first = 25): Promise<SubgraphPool[]> {
    const data = await gql(
      TOP_POOLS_QUERY,
      { first },
      z.object({ pools: z.array(PoolSchema) })
    );
    return data.pools;
  }

  async poolById(id: string): Promise<SubgraphPool | null> {
    const data = await gql(
      POOL_DETAIL_QUERY,
      { id: id.toLowerCase() },
      z.object({ pool: PoolSchema.nullable() })
    );
    return data.pool;
  }

  async positionsByOwner(owner: string): Promise<SubgraphPosition[]> {
    const data = await gql(
      POSITIONS_QUERY,
      { owner: owner.toLowerCase() },
      z.object({ positions: z.array(PositionSchema) })
    );
    return data.positions;
  }
}

export const uniswapClient = new UniswapClient();
