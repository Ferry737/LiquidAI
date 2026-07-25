// server/src/routes/status.ts
// v1.6: Observability routes.
//   GET /metrics    — Prometheus exposition (no auth, rate-limit exempt,
//                     excluded from request logging — see index.ts).
//   GET /api/status — HealthService dependency statuses + per-chain engine
//                     state (last worker run per chain from StrategyActions).

import type { FastifyInstance } from "fastify";
import { renderMetrics, metricsContentType } from "../lib/metrics";
import {
  healthService,
  subgraphDep,
  DEP_DEFILLAMA,
  DEP_TELEGRAM,
  DEP_LLM,
  DEP_DB,
} from "../lib/health";
import { chainClients } from "../lib/chainClients";
import { getEngineState, isDbReady } from "../lib/repo";
import { getDb, hasDatabase } from "../lib/db";
import { CHAINS } from "../../../shared/chains";
import type {
  ChainEngineStatusDto,
  StatusResponse,
} from "../../../shared/types";

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  // Prometheus metrics — public by design (scrapers don't authenticate).
  // Rate-limit exemption + log exclusion configured in index.ts.
  app.get("/metrics", { config: { rateLimit: false } }, async (_req, reply) => {
    reply.header("content-type", metricsContentType);
    return renderMetrics();
  });

  app.get("/api/status", async (): Promise<StatusResponse> => {
    // Record a DB health sample on every status read.
    const dbReady = await isDbReady();
    healthService.record(DEP_DB, dbReady);

    let engine = { running: false, dryRun: true, updatedAt: 0 };
    try {
      if (dbReady) engine = await getEngineState();
    } catch {
      // engine state unavailable — report defaults
    }

    const chains: ChainEngineStatusDto[] = await Promise.all(
      chainClients.enabled.map(async (slug): Promise<ChainEngineStatusDto> => {
        const info = CHAINS[slug];
        let lastRunTs: number | null = null;
        let lastRunOk: boolean | null = null;
        let lastError: string | null = null;
        if (dbReady && hasDatabase()) {
          try {
            const lastAction = await getDb().strategyAction.findFirst({
              where: { chainId: info.chainId },
              orderBy: { ts: "desc" },
            });
            if (lastAction) {
              lastRunTs = lastAction.ts.getTime();
              lastRunOk = lastAction.status !== "FAILED";
              if (lastAction.status === "FAILED") {
                try {
                  const details = JSON.parse(lastAction.detailsJson) as {
                    reason?: string;
                  };
                  lastError = details.reason ?? null;
                } catch {
                  lastError = null;
                }
              }
            }
          } catch {
            // per-chain status is best-effort
          }
        }
        return {
          chainId: info.chainId,
          slug,
          name: info.name,
          lastRunTs,
          lastRunOk,
          lastError,
        };
      })
    );

    // Ensure all known dependencies appear even before first sample.
    const ensure = [
      ...chainClients.enabled.map((s) => subgraphDep(s)),
      DEP_DEFILLAMA,
      DEP_TELEGRAM,
      DEP_LLM,
      DEP_DB,
    ];

    return {
      engine,
      chains,
      dependencies: healthService.snapshotAll(ensure),
      ts: Date.now(),
    };
  });
}
