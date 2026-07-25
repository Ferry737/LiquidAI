// server/src/routes/pools.ts
// v1.6: chain-aware — ?chain=<slug> query param (zod enum, default sepolia).
// GET /api/pools with chain=all returns per-chain results keyed by slug.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRankedPools, getPoolDetail } from "../services/pools";
import { BadRequestError } from "../lib/errors";
import { chainClients } from "../lib/chainClients";
import {
  CHAIN_SLUGS,
  DEFAULT_CHAIN_SLUG,
  type ChainSlug,
} from "../../../shared/chains";
import type { RankedPool } from "../../../shared/types";

export const ChainQuerySchema = z.enum(CHAIN_SLUGS).default(DEFAULT_CHAIN_SLUG);

const ListQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(100).default(25),
  chain: z.union([z.enum(CHAIN_SLUGS), z.literal("all")]).default(DEFAULT_CHAIN_SLUG),
});

const DetailQuerySchema = z.object({
  chain: ChainQuerySchema,
});

const PoolParamsSchema = z.object({
  id: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid pool address"),
});

export async function poolRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/pools", async (req) => {
    const query = ListQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new BadRequestError(query.error.issues[0].message);
    }

    if (query.data.chain === "all") {
      // Per-chain results; a failing chain yields an empty list + error note
      // instead of failing the whole response (chain isolation).
      const results: Record<string, { chainId: number; pools: RankedPool[]; error?: string }> = {};
      await Promise.all(
        chainClients.enabled.map(async (slug) => {
          const chainId = chainClients.chainInfo(slug).chainId;
          try {
            results[slug] = {
              chainId,
              pools: await getRankedPools(slug, query.data.first),
            };
          } catch (err) {
            results[slug] = {
              chainId,
              pools: [],
              error: (err as Error).message,
            };
          }
        })
      );
      return results;
    }

    const slug = query.data.chain as ChainSlug;
    chainClients.assertEnabled(slug);
    return getRankedPools(slug, query.data.first);
  });

  app.get("/api/pools/:id", async (req) => {
    const params = PoolParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new BadRequestError(params.error.issues[0].message);
    }
    const query = DetailQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new BadRequestError(query.error.issues[0].message);
    }
    chainClients.assertEnabled(query.data.chain);
    return getPoolDetail(query.data.chain, params.data.id);
  });
}
