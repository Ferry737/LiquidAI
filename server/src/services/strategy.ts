// server/src/services/strategy.ts
// Strategy config + action-log service. Reads/writes DB via the repo layer.

import type {
  PaginatedActions,
  StrategyConfigDto,
} from "../../../shared/types";
import {
  ensureStrategyConfig,
  getActions,
  getStrategyConfig,
  upsertStrategyConfig,
} from "../lib/repo";
import { NotFoundError } from "../lib/errors";
import { getDb } from "../lib/db";

/**
 * GET strategy config for a position. Creates default config if the position
 * exists but has no config yet.
 */
export async function getStrategy(
  positionId: string
): Promise<StrategyConfigDto> {
  // Verify the position exists.
  const pos = await getDb().position.findUnique({
    where: { id: positionId },
    select: { id: true },
  });
  if (!pos) throw new NotFoundError(`position ${positionId} not found`);

  const existing = await getStrategyConfig(positionId);
  if (existing) return existing;
  return ensureStrategyConfig(positionId);
}

export interface UpdateStrategyInput {
  enabled?: boolean;
  rebalanceAfterHrs?: number;
  compoundMinUsd?: number;
  maxSlippagePct?: number;
  stopLossIlPct?: number | null;
}

export async function updateStrategy(
  positionId: string,
  patch: UpdateStrategyInput
): Promise<StrategyConfigDto> {
  // Verify the position exists.
  const pos = await getDb().position.findUnique({
    where: { id: positionId },
    select: { id: true },
  });
  if (!pos) throw new NotFoundError(`position ${positionId} not found`);

  return upsertStrategyConfig(positionId, patch);
}

export async function getActionLog(
  positionId: string,
  page: number,
  pageSize: number
): Promise<PaginatedActions> {
  const { actions, total } = await getActions(positionId, page, pageSize);
  return {
    actions,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
