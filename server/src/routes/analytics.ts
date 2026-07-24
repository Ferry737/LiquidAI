// server/src/routes/analytics.ts
// v1.2: Analytics endpoint backed by DB history.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAnalytics } from "../services/analytics";
import { BadRequestError } from "../lib/errors";

const QuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(168),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/analytics", async (req) => {
    const query = QuerySchema.safeParse(req.query);
    if (!query.success)
      throw new BadRequestError(query.error.issues[0].message);
    return getAnalytics(query.data.hours);
  });
}
