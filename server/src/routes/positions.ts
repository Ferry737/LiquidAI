// server/src/routes/positions.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPositions } from "../services/positions";
import { BadRequestError } from "../lib/errors";

const ParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid EVM address"),
});

export async function positionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/positions/:address", async (req) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new BadRequestError(params.error.issues[0].message);
    }
    return getPositions(params.data.address);
  });
}
