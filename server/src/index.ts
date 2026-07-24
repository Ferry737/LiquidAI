// server/src/index.ts
// LiquidAI API — Fastify + TypeScript. Layered: routes -> services -> clients.

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./lib/config";
import { ApiError, toErrorBody } from "./lib/errors";
import { healthRoutes } from "./routes/health";
import { poolRoutes } from "./routes/pools";
import { protocolRoutes } from "./routes/protocol";
import { positionRoutes } from "./routes/positions";

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { colorize: true } },
    },
  });

  // CORS locked to the frontend origin.
  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    methods: ["GET"],
  });

  // 100 req/min/IP.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => toErrorBody("rate limit exceeded", "RATE_LIMITED"),
  });

  // Global typed error handler: { error, code, ts }.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      req.log.warn({ code: err.code, msg: err.message }, "api error");
      return reply.status(err.statusCode).send(toErrorBody(err.message, err.code));
    }
    // Fastify rate-limit / validation errors carry statusCode.
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err, "unhandled error");
    return reply
      .status(status)
      .send(
        toErrorBody(
          status >= 500 ? "internal server error" : err.message,
          status >= 500 ? "INTERNAL" : "REQUEST_ERROR"
        )
      );
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send(toErrorBody("route not found", "NOT_FOUND"))
  );

  await app.register(healthRoutes);
  await app.register(poolRoutes);
  await app.register(protocolRoutes);
  await app.register(positionRoutes);

  // Graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`LiquidAI API ready on :${config.PORT}`);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
