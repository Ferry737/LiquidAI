// server/src/routes/engine.ts
// v1.3: Engine state routes — GET/PUT /api/engine (running/dryRun state).
// v1.4: PUT (engine toggle) requires an authenticated session.

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

  // v1.4: mutating — requires a valid session. The engine is a global
  // singleton, so any authenticated wallet may toggle it (single-operator
  // deployment); unauthenticated requests are rejected.
  app.put("/api/engine", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    const body = UpdateBodySchema.safeParse(req.body);
    if (!body.success)
      throw new BadRequestError(body.error.issues[0].message);
    return updateEngine(body.data);
  });
}
