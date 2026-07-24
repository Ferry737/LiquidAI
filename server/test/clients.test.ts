// server/test/clients.test.ts
// Tests for client response-parsing logic using fixtures.
// Mocks all network (fetch) calls — no real API requests.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// These schemas mirror the ones in server/src/clients/uniswap.ts
// and server/src/clients/defillama.ts for isolated testing.

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
  token0: z.object({ id: z.string(), symbol: z.string(), decimals: z.string() }),
  token1: z.object({ id: z.string(), symbol: z.string(), decimals: z.string() }),
  totalValueLockedUSD: z.string(),
  volumeUSD: z.string(),
  poolDayData: z.array(PoolDayDataSchema).default([]),
});

const GraphQLEnvelope = z.object({
  data: z.unknown().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const YieldPoolSchema = z.object({
  pool: z.string(),
  chain: z.string(),
  project: z.string(),
  symbol: z.string(),
  tvlUsd: z.number(),
  apyBase: z.number().nullable().optional(),
  apyReward: z.number().nullable().optional(),
  volumeUsd1d: z.number().nullable().optional(),
  poolMeta: z.string().nullable().optional(),
  underlyingTokens: z.array(z.string().nullable()).nullable().optional(),
});

const YieldsEnvelope = z.object({
  status: z.string(),
  data: z.array(YieldPoolSchema),
});

// ---- Fixtures ----

const validPoolFixture = {
  id: "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
  feeTier: "500",
  liquidity: "123456789",
  token0: { id: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", decimals: "6" },
  token1: { id: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", symbol: "WETH", decimals: "18" },
  totalValueLockedUSD: "50000000",
  volumeUSD: "1000000",
  poolDayData: [
    { date: 1700000000, volumeUSD: "100000", feesUSD: "50", tvlUSD: "50000000" },
    { date: 1699900000, volumeUSD: "90000", feesUSD: "45", tvlUSD: "49000000" },
  ],
};

const validYieldsFixture = {
  status: "success",
  data: [
    {
      pool: "0xabc123",
      chain: "Ethereum",
      project: "uniswap-v3",
      symbol: "USDC-WETH",
      tvlUsd: 50_000_000,
      apyBase: 12.5,
      apyReward: null,
      volumeUsd1d: 1_000_000,
      poolMeta: "0.05%",
      underlyingTokens: ["0xa0b8...", "0xc02a..."],
    },
  ],
};

describe("Uniswap subgraph response parsing", () => {
  it("parses a valid top-pools response", () => {
    const envelope = {
      data: { pools: [validPoolFixture] },
    };
    const parsed = GraphQLEnvelope.parse(envelope);
    const dataSchema = z.object({ pools: z.array(PoolSchema) });
    const data = dataSchema.parse(parsed.data);
    expect(data.pools).toHaveLength(1);
    expect(data.pools[0].token0.symbol).toBe("USDC");
    expect(data.pools[0].poolDayData).toHaveLength(2);
  });

  it("handles missing poolDayData with default empty array", () => {
    const pool = { ...validPoolFixture, poolDayData: undefined };
    const parsed = PoolSchema.safeParse(pool);
    // zod default kicks in on undefined
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.poolDayData).toEqual([]);
    }
  });

  it("handles missing tvlUSD in day data with default '0'", () => {
    const dayData = { date: 1700000000, volumeUSD: "100", feesUSD: "5" };
    const parsed = PoolDayDataSchema.parse(dayData);
    expect(parsed.tvlUSD).toBe("0");
  });

  it("detects GraphQL errors in envelope", () => {
    const envelope = {
      errors: [{ message: "syntax error" }],
    };
    const parsed = GraphQLEnvelope.parse(envelope);
    expect(parsed.errors?.length).toBe(1);
    expect(parsed.errors?.[0].message).toBe("syntax error");
  });

  it("rejects a pool missing required token fields", () => {
    const badPool = { ...validPoolFixture, token0: { id: "0x1" } };
    expect(PoolSchema.safeParse(badPool).success).toBe(false);
  });

  it("rejects non-string feeTier", () => {
    const badPool = { ...validPoolFixture, feeTier: 500 };
    expect(PoolSchema.safeParse(badPool).success).toBe(false);
  });
});

describe("DefiLlama yields response parsing", () => {
  it("parses a valid yields response", () => {
    const parsed = YieldsEnvelope.parse(validYieldsFixture);
    expect(parsed.status).toBe("success");
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].apyBase).toBe(12.5);
  });

  it("filters by project name", () => {
    const parsed = YieldsEnvelope.parse(validYieldsFixture);
    const uniswapV3 = parsed.data.filter((p) => p.project === "uniswap-v3");
    expect(uniswapV3).toHaveLength(1);
  });

  it("handles null apyBase", () => {
    const fixture = {
      status: "success",
      data: [
        {
          pool: "0x1",
          chain: "Ethereum",
          project: "uniswap-v3",
          symbol: "DAI-USDC",
          tvlUsd: 1_000_000,
          apyBase: null,
          apyReward: null,
        },
      ],
    };
    const parsed = YieldsEnvelope.parse(fixture);
    expect(parsed.data[0].apyBase).toBeNull();
  });

  it("rejects non-number tvlUsd", () => {
    const bad = {
      ...validYieldsFixture,
      data: [{ ...validYieldsFixture.data[0], tvlUsd: "fifty-million" }],
    };
    expect(YieldsEnvelope.safeParse(bad).success).toBe(false);
  });

  it("parses poolMeta fee tier string", () => {
    const meta = "0.3%";
    const m = meta.match(/([\d.]+)\s*%/);
    expect(m).not.toBeNull();
    expect(m ? Math.round(parseFloat(m[1]) * 10000) : 0).toBe(3000);
  });
});

// ---- Mock fetch integration test ----

describe("fetch mock integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("graphql fetch parses envelope correctly", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { pools: [validPoolFixture] } }),
    } as Response);

    const res = await fetch("https://example.com/graphql", {
      method: "POST",
      body: JSON.stringify({ query: "query { pools { id } }" }),
    });
    const json = await res.json();
    const envelope = GraphQLEnvelope.parse(json);
    const dataSchema = z.object({ pools: z.array(PoolSchema) });

    expect(envelope.errors).toBeUndefined();
    const data = dataSchema.parse(envelope.data);
    expect(data.pools[0].id).toBe(validPoolFixture.id);
  });

  it("yields fetch handles network error gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(fetch("https://yields.llama.fi/pools")).rejects.toThrow(
      "ECONNREFUSED"
    );
  });
});
