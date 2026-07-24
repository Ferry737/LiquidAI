// server/src/routes/strategy.ts
// Per-position strategy config + action-log routes (zod-validated).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getActionLog, getStrategy, updateStrategy } from "../services/strategy";
import { BadRequestError } from "../lib/errors";

const PositionIdSchema = z.object({
  id: z.string().min(1).max(64),
});

/**
 * Zod schema for PUT body. All fields optional; null is valid for stopLossIlPct.
 * Ranges enforce sensible bounds.
 */
const UpdateBodySchema = z.object({
  enabled: z.boolean().optional(),
  rebalanceAfterHrs: z.number().min(0).max(168).optional(),
  compoundMinUsd: z.number().min(0).max(10000).optional(),
  maxSlippagePct: z.number().min(0).max(10).optional(),
  stopLossIlPct: z.number().min(0).max(100).nullable().optional(),
});

const ActionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function strategyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/positions/:id/strategy", async (req) => {
    const params = PositionIdSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);
    return getStrategy(params.data.id);
  });

  app.put("/api/positions/:id/strategy", async (req) => {
    const params = PositionIdSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);

    const body = UpdateBodySchema.safeParse(req.body);
    if (!body.success)
      throw new BadRequestError(body.error.issues[0].message);

    return updateStrategy(params.data.id, body.data);
  });

  app.get("/api/positions/:id/actions", async (req) => {
    const params = PositionIdSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);

    const query = ActionQuerySchema.safeParse(req.query);
    if (!query.success)
      throw new BadRequestError(query.error.issues[0].message);

    return getActionLog(params.data.id, query.data.page, query.data.pageSize);
  });
}
