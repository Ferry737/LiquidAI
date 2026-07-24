// server/src/routes/pools.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRankedPools, getPoolDetail } from "../services/pools";
import { BadRequestError } from "../lib/errors";

const ListQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(100).default(25),
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
    return getRankedPools(query.data.first);
  });

  app.get("/api/pools/:id", async (req) => {
    const params = PoolParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new BadRequestError(params.error.issues[0].message);
    }
    return getPoolDetail(params.data.id);
  });
}
