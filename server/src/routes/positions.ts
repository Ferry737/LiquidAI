// server/src/routes/positions.ts
// v1.6: chain-aware — ?chain=<slug> query param (zod enum, default sepolia).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPositions } from "../services/positions";
import { BadRequestError } from "../lib/errors";
import { chainClients } from "../lib/chainClients";
import { CHAIN_SLUGS, DEFAULT_CHAIN_SLUG } from "../../../shared/chains";

const ParamsSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid EVM address"),
});

const QuerySchema = z.object({
  chain: z.enum(CHAIN_SLUGS).default(DEFAULT_CHAIN_SLUG),
});

export async function positionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/positions/:address", async (req) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new BadRequestError(params.error.issues[0].message);
    }
    const query = QuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new BadRequestError(query.error.issues[0].message);
    }
    chainClients.assertEnabled(query.data.chain);
    return getPositions(query.data.chain, params.data.address);
  });
}
