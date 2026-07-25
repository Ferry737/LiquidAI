// server/src/index.ts
// LiquidAI API — Fastify + TypeScript. Layered: routes -> services -> clients.
// v1.3: SSE streaming, Telegram notifications, simulation-backed dry-run.
// v1.4: SIWE auth (httpOnly JWT cookie) + backtesting routes.
// v1.6: multi-chain boot validation (fail fast), prom-client /metrics,
// reqId tracing, HealthService + /api/status, nightly retention cron.

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import { config } from "./lib/config";
import { ApiError, toErrorBody } from "./lib/errors";
import { connectDb, disconnectDb, hasDatabase } from "./lib/db";
import { getStreamPoller } from "./lib/streamPoller";
import { authPlugin } from "./lib/auth";
import { httpRequestDuration } from "./lib/metrics";
import { healthService, DEP_DB } from "./lib/health";
import { runRetention } from "./services/retention";
import { healthRoutes } from "./routes/health";
import { poolRoutes } from "./routes/pools";
import { protocolRoutes } from "./routes/protocol";
import { positionRoutes } from "./routes/positions";
import { strategyRoutes } from "./routes/strategy";
import { analyticsRoutes } from "./routes/analytics";
import { streamRoutes } from "./routes/stream";
import { notificationRoutes } from "./routes/notifications";
import { engineRoutes } from "./routes/engine";
import { authRoutes } from "./routes/auth";
import { backtestRoutes } from "./routes/backtests";
import { statusRoutes } from "./routes/status";

// v1.6: nightly retention at 03:10 UTC.
const RETENTION_INTERVAL_MS = 24 * 3_600_000;

function msUntilNextRetention(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(3, 10, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

async function main(): Promise<void> {
  const app = Fastify({
    // v1.6: reqId (uuid) per request — propagated by pino into every log
    // line and echoed in error responses via the reply serializer.
    genReqId: () => randomUUID(),
    // /metrics is excluded from request logging (scraped every few seconds).
    disableRequestLogging: false,
    logger: {
      level: config.LOG_LEVEL,
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { colorize: true } },
    },
  });

  // v1.6: exclude /metrics from request logging + record HTTP metrics for
  // everything else.
  app.addHook("onRoute", (route) => {
    if (route.url === "/metrics") {
      route.logLevel = "silent";
    }
  });
  app.addHook("onResponse", (req, reply, done) => {
    if (req.routeOptions?.url !== "/metrics") {
      httpRequestDuration.observe(
        {
          route: req.routeOptions?.url ?? req.url,
          method: req.method,
          status: String(reply.statusCode),
        },
        reply.elapsedTime / 1000
      );
    }
    done();
  });

  // Connect to Postgres if configured. Persistence is optional — the API
  // still serves live subgraph data without it.
  if (hasDatabase()) {
    try {
      await connectDb();
      healthService.record(DEP_DB, true);
      app.log.info("database connected");
    } catch (err) {
      healthService.record(DEP_DB, false, (err as Error).message);
      app.log.warn({ err }, "database connection failed — running without persistence");
    }
  } else {
    app.log.warn("DATABASE_URL not set — persistence features disabled");
  }

  // CORS locked to the frontend origin. credentials:true so the session
  // cookie flows on cross-origin requests from the Next.js app.
  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  });

  // v1.4: cookie parsing (must be registered before the auth plugin).
  await app.register(cookie);

  // v1.4: SIWE auth layer — resolves req.session on every request and
  // exposes app.requireAuth for mutating routes.
  await app.register(authPlugin);

  // 100 req/min/IP. Routes can opt out via config.rateLimit=false (/metrics).
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => toErrorBody("rate limit exceeded", "RATE_LIMITED"),
  });

  // Global typed error handler: { error, code, ts, reqId }.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ApiError) {
      req.log.warn({ code: err.code, msg: err.message }, "api error");
      return reply
        .status(err.statusCode)
        .send({ ...toErrorBody(err.message, err.code), reqId: req.id });
    }
    // Fastify rate-limit / validation errors carry statusCode.
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err, "unhandled error");
    return reply.status(status).send({
      ...toErrorBody(
        status >= 500 ? "internal server error" : err.message,
        status >= 500 ? "INTERNAL" : "REQUEST_ERROR"
      ),
      reqId: req.id,
    });
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send(toErrorBody("route not found", "NOT_FOUND"))
  );

  // v1.2 routes
  await app.register(healthRoutes);
  await app.register(poolRoutes);
  await app.register(protocolRoutes);
  await app.register(positionRoutes);
  await app.register(strategyRoutes);
  await app.register(analyticsRoutes);
  // v1.3 routes
  await app.register(streamRoutes);
  await app.register(notificationRoutes);
  await app.register(engineRoutes);
  // v1.4 routes
  await app.register(authRoutes);
  await app.register(backtestRoutes);
  // v1.6 routes (/metrics + /api/status)
  await app.register(statusRoutes);

  // v1.3: Start the stream poller (publishes DB changes to SSE subscribers)
  if (hasDatabase()) {
    getStreamPoller().start();
    app.log.info("stream poller started (30s interval)");
  }

  // v1.6: nightly retention job (aggregate + prune). First run at next
  // 03:10 UTC, then every 24h.
  let retentionTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleRetention = (delayMs: number): void => {
    retentionTimer = setTimeout(() => {
      const runId = randomUUID();
      void runRetention()
        .then((res) =>
          app.log.info({ runId, ...res }, "retention run complete")
        )
        .catch((err) => app.log.error({ runId, err }, "retention run failed"))
        .finally(() => scheduleRetention(RETENTION_INTERVAL_MS));
    }, delayMs);
    retentionTimer.unref?.();
  };
  if (hasDatabase()) {
    scheduleRetention(msUntilNextRetention());
    app.log.info("retention job scheduled (nightly 03:10 UTC)");
  }

  // Graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    getStreamPoller().stop();
    if (retentionTimer) clearTimeout(retentionTimer);
    await app.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(
    `LiquidAI API ready on :${config.PORT} · chains: ${config.enabledChains.join(", ")}`
  );
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
