// server/src/routes/mainnet.ts
// v1.7: GET /api/mainnet/config — feature flag + read-only mainnet chain list
// exposed to the frontend so the UI can render the gated "Go Live" state and
// the mainnet read-only surfaces.

import type { FastifyInstance } from "fastify";
import { config } from "../lib/config";
import {
  ALL_MAINNET_CHAINS,
} from "../../../shared/chains";
import {
  MAINNET_MIN_DRY_RUNS,
  MAINNET_ACK_MAX_AGE_MS,
} from "../../../shared/policy";
import type { MainnetConfigDto } from "../../../shared/types";

export async function mainnetRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/mainnet/config", async (): Promise<MainnetConfigDto> => {
    return {
      mainnetExecutionEnabled: config.MAINNET_EXECUTION_ENABLED === true,
      mainnetChains: ALL_MAINNET_CHAINS.map((c) => ({
        chainId: c.chainId,
        slug: c.slug,
        name: c.name,
      })),
      minDryRuns: MAINNET_MIN_DRY_RUNS,
      ackMaxAgeMs: MAINNET_ACK_MAX_AGE_MS,
    };
  });
}
