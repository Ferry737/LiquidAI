// server/src/routes/protocol.ts
import type { FastifyInstance } from "fastify";
import { getProtocolStats } from "../services/protocol";

export async function protocolRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/protocol/stats", async () => getProtocolStats());
}
