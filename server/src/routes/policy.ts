// server/src/routes/policy.ts
// v1.7: Policy routes — GET/PUT /api/policy/:chainSlug.
//   GET  returns the chain's spend policy (+ hardcoded ceiling for mainnet).
//   PUT  updates it (auth required, audit-logged). Mainnet caps are CLAMPED to
//        the ceilings in /shared/policy.ts — a PUT can NEVER raise a mainnet cap
//        above them (enforced in repo.updatePolicyConfig).

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPolicyConfig, updatePolicyConfig } from "../lib/repo";
import { BadRequestError, NotFoundError } from "../lib/errors";
import { chainBySlugAny } from "../../../shared/chains";
import type { PolicyConfigDto } from "../../../shared/types";

const ParamsSchema = z.object({ chainSlug: z.string().min(1) });

const UpdateSchema = z.object({
  maxUsdPerAction: z.number().nonnegative().optional(),
  maxActionsPerPositionPerDay: z.number().int().nonnegative().optional(),
  maxDailyGasUsd: z.number().nonnegative().optional(),
  allowedPools: z.array(z.string()).optional(),
  allowedTokens: z.array(z.string()).optional(),
});

export async function policyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/policy/:chainSlug", async (req): Promise<PolicyConfigDto> => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) throw new BadRequestError("invalid chain slug");
    const chain = chainBySlugAny(params.data.chainSlug);
    if (!chain) throw new NotFoundError(`unknown chain: ${params.data.chainSlug}`);
    return getPolicyConfig(chain.chainId);
  });

  app.put(
    "/api/policy/:chainSlug",
    { preHandler: [app.requireAuth] },
    async (req): Promise<PolicyConfigDto> => {
      const params = ParamsSchema.safeParse(req.params);
      if (!params.success) throw new BadRequestError("invalid chain slug");
      const chain = chainBySlugAny(params.data.chainSlug);
      if (!chain)
        throw new NotFoundError(`unknown chain: ${params.data.chainSlug}`);

      const body = UpdateSchema.safeParse(req.body);
      if (!body.success) throw new BadRequestError(body.error.issues[0].message);

      const actor = req.session?.address ?? "anonymous";
      const { before, after } = await updatePolicyConfig(chain.chainId, {
        ...body.data,
        updatedBy: actor,
      });

      await app.audit(req, {
        action: "policy.update",
        resource: `policy:${chain.slug}`,
        before,
        after,
      });

      return after;
    }
  );
}
