// server/src/routes/engine.ts
// v1.3: Engine state routes — GET/PUT /api/engine (running/dryRun state).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getEngine, updateEngine } from "../services/engineState";
import { BadRequestError } from "../lib/errors";

const UpdateBodySchema = z.object({
  running: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function engineRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/engine", async () => {
    return getEngine();
  });

  app.put("/api/engine", async (req) => {
    const body = UpdateBodySchema.safeParse(req.body);
    if (!body.success)
      throw new BadRequestError(body.error.issues[0].message);
    return updateEngine(body.data);
  });
}
