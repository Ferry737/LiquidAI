// server/src/routes/health.ts
import type { FastifyInstance } from "fastify";

const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    status: "ok",
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    ts: Date.now(),
  }));
}
