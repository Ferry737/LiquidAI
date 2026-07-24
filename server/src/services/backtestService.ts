// server/src/services/backtestService.ts
// v1.4: Orchestrates backtest execution — fetches data via HistoryService,
// runs the pure backtester, persists results.

import type { BacktestConfig, BacktestDto, CreateBacktestInput } from "../../../shared/types";
import { runBacktest as computeBacktest } from "./backtester";
import { getPoolHourData } from "./historyService";
import { getDb, hasDatabase } from "../lib/db";

export interface BacktestParams {
  owner: string;
  poolId: string;
  from: number;
  to: number;
  initialUsd: number;
  rangeWidthPct: number;
  config: BacktestConfig;
}

/**
 * Run a backtest synchronously and persist the result.
 */
export async function runBacktestAndPersist(params: BacktestParams): Promise<BacktestDto> {
  // Fetch hourly data.
  const bars = await getPoolHourData(params.poolId, params.from, params.to);

  // Run the pure backtester.
  const result = computeBacktest({
    bars,
    initialUsd: params.initialUsd,
    rangeWidthPct: params.rangeWidthPct,
    config: params.config,
  });

  const paramsJson = JSON.stringify({
    initialUsd: params.initialUsd,
    rangeWidthPct: params.rangeWidthPct,
    config: params.config,
  });
  const resultJson = JSON.stringify(result);

  // Persist to DB.
  if (hasDatabase()) {
    const db = getDb();
    const row = await db.backtest.create({
      data: {
        owner: params.owner.toLowerCase(),
        poolId: params.poolId.toLowerCase(),
        from: new Date(params.from),
        to: new Date(params.to),
        paramsJson,
        resultJson,
      },
    });
    return {
      id: row.id,
      owner: row.owner,
      poolId: row.poolId,
      from: row.from.getTime(),
      to: row.to.getTime(),
      paramsJson: row.paramsJson,
      resultJson: row.resultJson,
      createdAt: row.createdAt.getTime(),
    };
  }

  // No DB: return ephemeral result.
  return {
    id: "ephemeral",
    owner: params.owner.toLowerCase(),
    poolId: params.poolId.toLowerCase(),
    from: params.from,
    to: params.to,
    paramsJson,
    resultJson,
    createdAt: Date.now(),
  };
}

/** Alias for the route handler. */
export { runBacktestAndPersist as runBacktest };

/**
 * Get backtest history for an owner.
 */
export async function getBacktestHistory(owner: string): Promise<BacktestDto[]> {
  if (!hasDatabase()) return [];
  const db = getDb();
  const rows = await db.backtest.findMany({
    where: { owner: owner.toLowerCase() },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

/**
 * Get a single backtest by ID.
 */
export async function getBacktestById(id: string): Promise<BacktestDto | null> {
  if (!hasDatabase()) return null;
  const db = getDb();
  const row = await db.backtest.findUnique({ where: { id } });
  return row ? rowToDto(row) : null;
}

function rowToDto(row: {
  id: string; owner: string; poolId: string;
  from: Date; to: Date; paramsJson: string; resultJson: string;
  createdAt: Date;
}): BacktestDto {
  return {
    id: row.id,
    owner: row.owner,
    poolId: row.poolId,
    from: row.from.getTime(),
    to: row.to.getTime(),
    paramsJson: row.paramsJson,
    resultJson: row.resultJson,
    createdAt: row.createdAt.getTime(),
  };
}
