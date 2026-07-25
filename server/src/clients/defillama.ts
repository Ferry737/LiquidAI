// server/src/clients/defillama.ts
// DefiLlama public REST client (api.llama.fi + yields.llama.fi), zod-validated.
// v1.6: latency/error metrics + health signals on every call.

import { z } from "zod";
import { config } from "../lib/config";
import { UpstreamError } from "../lib/errors";
import { timeExternalCall } from "../lib/metrics";
import { healthService, DEP_DEFILLAMA } from "../lib/health";

const ProtocolSchema = z.object({
  tvl: z
    .array(z.object({ date: z.number(), totalLiquidityUSD: z.number() }))
    .optional(),
  currentChainTvls: z.record(z.number()).optional(),
});

const ChainTvlPointSchema = z.array(
  z.object({ date: z.number(), tvl: z.number() })
);

const DexSummarySchema = z.object({
  total24h: z.number().nullable().optional(),
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

export type YieldPool = z.infer<typeof YieldPoolSchema>;

async function getJson<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
  chain = "-"
): Promise<z.output<S>> {
  return timeExternalCall(
    "defillama",
    chain,
    async () => {
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        throw new UpstreamError("defillama", (err as Error).message);
      }
      if (!res.ok)
        throw new UpstreamError("defillama", `HTTP ${res.status} ${url}`);
      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) {
        throw new UpstreamError(
          "defillama",
          `schema mismatch: ${parsed.error.issues[0]?.message ?? "unknown"}`
        );
      }
      return parsed.data;
    },
    (ok) => healthService.record(DEP_DEFILLAMA, ok)
  );
}

export class DefiLlamaClient {
  private base = config.DEFILLAMA_BASE.replace(/\/$/, "");
  private yieldsBase = config.DEFILLAMA_YIELDS_BASE.replace(/\/$/, "");

  /** Current Uniswap v3 protocol TVL (USD). */
  async protocolTvl(slug = "uniswap-v3"): Promise<number> {
    // /tvl/{slug} returns a bare number — simplest and cheapest endpoint.
    return getJson(`${this.base}/tvl/${slug}`, z.number());
  }

  /** Latest Ethereum chain TVL (USD). */
  async chainTvl(chain = "Ethereum"): Promise<number> {
    const series = await getJson(
      `${this.base}/v2/historicalChainTvl/${chain}`,
      ChainTvlPointSchema
    );
    return series.length ? series[series.length - 1].tvl : 0;
  }

  /** Uniswap 24h DEX volume (USD) from the dexs overview endpoint. */
  async dexVolume24h(slug = "uniswap"): Promise<number> {
    const summary = await getJson(
      `${this.base}/summary/dexs/${slug}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
      DexSummarySchema
    );
    return summary.total24h ?? 0;
  }

  /** All uniswap-v3 yield pools, filterable by chain. */
  async uniswapYields(chain?: string): Promise<YieldPool[]> {
    const envelope = await getJson(`${this.yieldsBase}/pools`, YieldsEnvelope);
    return envelope.data.filter(
      (p) =>
        p.project === "uniswap-v3" &&
        (chain ? p.chain.toLowerCase() === chain.toLowerCase() : true)
    );
  }
}

export const defiLlamaClient = new DefiLlamaClient();
