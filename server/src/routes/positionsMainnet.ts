// server/src/routes/positionsMainnet.ts
// v1.7: Per-position mainnet opt-in routes.
//   GET  /api/positions/:id/mainnet-checklist — live status of the 3 gates.
//   POST /api/positions/:id/enable-mainnet     — enable (auth + audited).
//
// Enabling requires ALL of, enforced server-side in this ONE route:
//   (1) valid SIWE session matching the position owner
//   (2) >= MAINNET_MIN_DRY_RUNS successful DRY_RUN simulations on the position
//   (3) a fresh EIP-191 signature by the owner over the canonical ack string
// PLUS the global MAINNET_EXECUTION_ENABLED flag (checked here and, at execution
// time, again at the signer + policy layers — defense in depth).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../lib/config";
import {
  getPositionById,
  countSuccessfulDryRuns,
  getMainnetAck,
  enablePositionMainnet,
} from "../lib/repo";
import { verifyMainnetAck } from "../services/mainnetOptIn";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ApiError,
} from "../lib/errors";
import { isMainnetChainId } from "../../../shared/chains";
import { MAINNET_MIN_DRY_RUNS } from "../../../shared/policy";
import type { MainnetChecklistDto } from "../../../shared/types";

const ParamsSchema = z.object({ id: z.string().min(1) });

const EnableSchema = z.object({
  chainId: z.number().int().positive(),
  message: z.string().min(1),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, "invalid signature"),
  timestamp: z.number().int().positive(),
});

export async function positionsMainnetRoutes(
  app: FastifyInstance
): Promise<void> {
  app.get(
    "/api/positions/:id/mainnet-checklist",
    { preHandler: [app.requireAuth] },
    async (req): Promise<MainnetChecklistDto> => {
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) throw new BadRequestError("invalid position id");
      const pos = await getPositionById(params.data.id);
      if (!pos) throw new NotFoundError("position not found");

      const owner = req.session?.address ?? "";
      const ownerVerified = owner.toLowerCase() === pos.owner.toLowerCase();
      const dryRunCount = await countSuccessfulDryRuns(pos.id);
      const ack = await getMainnetAck(pos.id);

      return {
        positionId: pos.id,
        ownerVerified,
        dryRunCount,
        dryRunsRequired: MAINNET_MIN_DRY_RUNS,
        dryRunsSatisfied: dryRunCount >= MAINNET_MIN_DRY_RUNS,
        acknowledged: ack !== null,
        featureEnabled: config.MAINNET_EXECUTION_ENABLED === true,
        mainnetEnabled: pos.mainnetEnabled,
      };
    }
  );

  app.post(
    "/api/positions/:id/enable-mainnet",
    { preHandler: [app.requireAuth] },
    async (req): Promise<MainnetChecklistDto> => {
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) throw new BadRequestError("invalid position id");
      const body = EnableSchema.safeParse(req.body);
      if (!body.success) throw new BadRequestError(body.error.issues[0].message);

      const pos = await getPositionById(params.data.id);
      if (!pos) throw new NotFoundError("position not found");

      const owner = req.session?.address ?? "";

      // (1) Ownership.
      if (owner.toLowerCase() !== pos.owner.toLowerCase()) {
        throw new ForbiddenError("not the position owner");
      }

      // Feature flag — enabling opt-in while mainnet execution is globally
      // disabled is refused (the UI also blocks this, but never trust the UI).
      if (config.MAINNET_EXECUTION_ENABLED !== true) {
        throw new ApiError(
          409,
          "MAINNET_DISABLED",
          "mainnet execution is disabled pending security review"
        );
      }

      // The chain the ack is for must actually be a mainnet chain.
      if (!isMainnetChainId(body.data.chainId)) {
        throw new BadRequestError("chainId is not a mainnet chain");
      }

      // (2) Dry-run history.
      const dryRunCount = await countSuccessfulDryRuns(pos.id);
      if (dryRunCount < MAINNET_MIN_DRY_RUNS) {
        throw new ApiError(
          412,
          "PRECONDITION_FAILED",
          `position needs >= ${MAINNET_MIN_DRY_RUNS} successful dry-run simulations (has ${dryRunCount})`
        );
      }

      // (3) EIP-191 acknowledgment signature.
      const verify = await verifyMainnetAck({
        positionId: pos.id,
        owner: pos.owner,
        chainId: body.data.chainId,
        message: body.data.message,
        signature: body.data.signature,
        timestamp: body.data.timestamp,
      });
      if (!verify.ok) {
        throw new ApiError(400, "ACK_INVALID", verify.reason);
      }

      // All checks passed — persist ack + flip the flag atomically.
      await enablePositionMainnet({
        positionId: pos.id,
        owner: pos.owner,
        message: body.data.message,
        signature: body.data.signature,
        timestamp: body.data.timestamp,
      });

      await app.audit(req, {
        action: "position.enable-mainnet",
        resource: `position:${pos.id}`,
        before: { mainnetEnabled: pos.mainnetEnabled },
        after: { mainnetEnabled: true, chainId: body.data.chainId },
      });

      return {
        positionId: pos.id,
        ownerVerified: true,
        dryRunCount,
        dryRunsRequired: MAINNET_MIN_DRY_RUNS,
        dryRunsSatisfied: true,
        acknowledged: true,
        featureEnabled: true,
        mainnetEnabled: true,
      };
    }
  );
}
