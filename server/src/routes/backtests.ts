// server/src/routes/backtests.ts
// v1.4: Backtesting routes — all auth-required.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runBacktest, getBacktestHistory, getBacktestById } from "../services/backtestService";
import { BadRequestError, NotFoundError } from "../lib/errors";
import type { BacktestConfig } from "../../../shared/types";

const ConfigSchema = z.object({
  rebalanceAfterHrs: z.number().min(0).max(168),
  compoundMinUsd: z.number().min(0).max(100000),
  maxSlippagePct: z.number().min(0).max(10),
  stopLossIlPct: z.number().min(0).max(100).nullable(),
});

const CreateBodySchema = z.object({
  poolId: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid pool address"),
  from: z.number().int().positive(),
  to: z.number().int().positive(),
  initialUsd: z.number().min(1).max(10_000_000),
  rangeWidthPct: z.number().min(0.5).max(100),
  config: ConfigSchema,
});

const IdSchema = z.object({
  id: z.string().min(1).max(64),
});

export async function backtestRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/backtests — run a backtest synchronously, persist result.
  app.post("/api/backtests", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    const body = CreateBodySchema.safeParse(req.body);
    if (!body.success)
      throw new BadRequestError(body.error.issues[0].message);

    if (body.data.to <= body.data.from)
      throw new BadRequestError("'to' must be after 'from'");

    // Construct the config explicitly so the wire shape can never drift from
    // the shared BacktestConfig contract.
    const config: BacktestConfig = {
      rebalanceAfterHrs: body.data.config.rebalanceAfterHrs,
      compoundMinUsd: body.data.config.compoundMinUsd,
      maxSlippagePct: body.data.config.maxSlippagePct,
      stopLossIlPct: body.data.config.stopLossIlPct,
    };

    return runBacktest({
      owner: req.session!.address,
      poolId: body.data.poolId,
      from: body.data.from,
      to: body.data.to,
      initialUsd: body.data.initialUsd,
      rangeWidthPct: body.data.rangeWidthPct,
      config,
    });
  });

  // GET /api/backtests — own backtest history.
  app.get("/api/backtests", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    return getBacktestHistory(req.session!.address);
  });

  // GET /api/backtests/:id — single backtest (owner only; 404 to avoid
  // leaking existence of other users' backtests).
  app.get("/api/backtests/:id", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    const params = IdSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);

    const bt = await getBacktestById(params.data.id);
    if (!bt) throw new NotFoundError(`backtest ${params.data.id} not found`);
    if (bt.owner.toLowerCase() !== req.session!.address.toLowerCase()) {
      throw new NotFoundError(`backtest ${params.data.id} not found`);
    }
    return bt;
  });
}
