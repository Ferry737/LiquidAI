// server/src/lib/repo.ts
// Data-access layer: all Prisma queries live here. Services call repo
// functions, never touch Prisma directly — making mocking trivial in tests.
// v1.3: adds NotificationSetting + EngineState queries.

import type {
  StrategyActionDto,
  StrategyActionStatus,
  StrategyActionType,
  StrategyConfigDto,
  PositionSnapshotDto,
  NotificationSettingDto,
  EngineStateDto,
} from "../../../shared/types";
import { getDb, hasDatabase } from "./db";

// ---- Position ----

export interface UpsertPositionInput {
  chainId: number;
  tokenId: string;
  owner: string;
  pool: string;
  token0: string;
  token1: string;
  feeTier: number;
  tickLower: number;
  tickUpper: number;
}

export async function upsertPosition(
  input: UpsertPositionInput
): Promise<string> {
  const db = getDb();
  const pos = await db.position.upsert({
    where: {
      chainId_tokenId: {
        chainId: input.chainId,
        tokenId: input.tokenId,
      },
    },
    create: input,
    update: {
      owner: input.owner,
      pool: input.pool,
      token0: input.token0,
      token1: input.token1,
      feeTier: input.feeTier,
      tickLower: input.tickLower,
      tickUpper: input.tickUpper,
    },
    select: { id: true },
  });
  return pos.id;
}

// ---- PositionSnapshot ----

export interface SnapshotInput {
  positionId: string;
  liquidity: string;
  amount0: string;
  amount1: string;
  unclaimedFeesUsd: number;
  valueUsd: number;
  inRange: boolean;
  ilPct: number;
}

export async function insertSnapshot(
  input: SnapshotInput
): Promise<PositionSnapshotDto> {
  const db = getDb();
  const row = await db.positionSnapshot.create({ data: input });
  return snapshotToDto(row);
}

export async function getSnapshots(
  positionId: string,
  limit = 500
): Promise<PositionSnapshotDto[]> {
  const db = getDb();
  const rows = await db.positionSnapshot.findMany({
    where: { positionId },
    orderBy: { ts: "asc" },
    take: limit,
  });
  return rows.map(snapshotToDto);
}

// ---- StrategyConfig ----

export async function getStrategyConfig(
  positionId: string
): Promise<StrategyConfigDto | null> {
  const db = getDb();
  const row = await db.strategyConfig.findUnique({
    where: { positionId },
  });
  return row ? configToDto(row) : null;
}

export async function upsertStrategyConfig(
  positionId: string,
  patch: {
    enabled?: boolean;
    rebalanceAfterHrs?: number;
    compoundMinUsd?: number;
    maxSlippagePct?: number;
    stopLossIlPct?: number | null;
  }
): Promise<StrategyConfigDto> {
  const db = getDb();
  const row = await db.strategyConfig.upsert({
    where: { positionId },
    create: { positionId, ...patch },
    update: patch,
  });
  return configToDto(row);
}

/**
 * Get or create a StrategyConfig with defaults.
 * The Position row must exist before calling this.
 */
export async function ensureStrategyConfig(
  positionId: string
): Promise<StrategyConfigDto> {
  const db = getDb();
  const row = await db.strategyConfig.upsert({
    where: { positionId },
    create: { positionId },
    update: {},
  });
  return configToDto(row);
}

// ---- StrategyAction ----

export interface ActionInput {
  positionId: string;
  type: StrategyActionType;
  status: StrategyActionStatus;
  txHash?: string | null;
  detailsJson: string;
}

export async function insertAction(
  input: ActionInput
): Promise<StrategyActionDto> {
  const db = getDb();
  const row = await db.strategyAction.create({
    data: {
      positionId: input.positionId,
      type: input.type,
      status: input.status,
      txHash: input.txHash ?? null,
      detailsJson: input.detailsJson,
    },
  });
  return actionToDto(row);
}

export async function getActions(
  positionId: string,
  page: number,
  pageSize: number
): Promise<{ actions: StrategyActionDto[]; total: number }> {
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.strategyAction.findMany({
      where: { positionId },
      orderBy: { ts: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.strategyAction.count({ where: { positionId } }),
  ]);
  return { actions: rows.map(actionToDto), total };
}

// ---- v1.3: Recent actions across all positions (for StreamPoller) ----

export async function getRecentActions(
  sinceTs: Date,
  limit = 50
): Promise<StrategyActionDto[]> {
  const db = getDb();
  const rows = await db.strategyAction.findMany({
    where: { ts: { gt: sinceTs } },
    orderBy: { ts: "asc" },
    take: limit,
  });
  return rows.map(actionToDto);
}

// ---- Analytics aggregates ----

export async function getLatestSnapshotsAll(): Promise<
  PositionSnapshotDto[]
> {
  const db = getDb();
  // Distinct-on: latest snapshot per positionId.
  const rows = await db.positionSnapshot.findMany({
    distinct: ["positionId"],
    orderBy: [{ positionId: "asc" }, { ts: "desc" }],
  });
  return rows.map(snapshotToDto);
}

export async function getSnapshotSeries(
  hours: number
): Promise<PositionSnapshotDto[]> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await db.positionSnapshot.findMany({
    where: { ts: { gte: since } },
    orderBy: { ts: "asc" },
  });
  return rows.map(snapshotToDto);
}

export async function getTotalSnapshotCount(): Promise<number> {
  const db = getDb();
  return db.positionSnapshot.count();
}

export async function getTotalPositionCount(): Promise<number> {
  const db = getDb();
  return db.position.count();
}

/** True when the DB is configured and reachable. */
export async function isDbReady(): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    await getDb().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// ---- v1.3: NotificationSetting ----

export interface NotificationSettingInput {
  owner: string;
  telegramChatId?: string | null;
  enabled?: boolean;
  onRebalance?: boolean;
  onCompound?: boolean;
  onStopLoss?: boolean;
  onFailure?: boolean;
  onOutOfRangeHrs?: number | null;
}

export async function getNotificationSetting(
  owner: string
): Promise<NotificationSettingDto | null> {
  const db = getDb();
  const row = await db.notificationSetting.findUnique({
    where: { owner },
  });
  return row ? notificationToDto(row) : null;
}

export async function upsertNotificationSetting(
  input: NotificationSettingInput
): Promise<NotificationSettingDto> {
  const db = getDb();
  const row = await db.notificationSetting.upsert({
    where: { owner: input.owner },
    create: {
      owner: input.owner,
      telegramChatId: input.telegramChatId ?? null,
      enabled: input.enabled ?? false,
      onRebalance: input.onRebalance ?? true,
      onCompound: input.onCompound ?? true,
      onStopLoss: input.onStopLoss ?? true,
      onFailure: input.onFailure ?? true,
      onOutOfRangeHrs: input.onOutOfRangeHrs ?? null,
    },
    update: {
      ...(input.telegramChatId !== undefined && { telegramChatId: input.telegramChatId }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.onRebalance !== undefined && { onRebalance: input.onRebalance }),
      ...(input.onCompound !== undefined && { onCompound: input.onCompound }),
      ...(input.onStopLoss !== undefined && { onStopLoss: input.onStopLoss }),
      ...(input.onFailure !== undefined && { onFailure: input.onFailure }),
      ...(input.onOutOfRangeHrs !== undefined && { onOutOfRangeHrs: input.onOutOfRangeHrs }),
    },
  });
  return notificationToDto(row);
}

// ---- v1.3: EngineState (singleton) ----

const SINGLETON_ID = "singleton";

export async function getEngineState(): Promise<EngineStateDto> {
  const db = getDb();
  let row = await db.engineState.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) {
    row = await db.engineState.create({
      data: { id: SINGLETON_ID, running: true, dryRun: true },
    });
  }
  return {
    running: row.running,
    dryRun: row.dryRun,
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function updateEngineState(patch: {
  running?: boolean;
  dryRun?: boolean;
}): Promise<EngineStateDto> {
  const db = getDb();
  // Upsert to handle the case where the singleton doesn't exist yet.
  const row = await db.engineState.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      running: patch.running ?? true,
      dryRun: patch.dryRun ?? true,
    },
    update: patch,
  });
  return {
    running: row.running,
    dryRun: row.dryRun,
    updatedAt: row.updatedAt.getTime(),
  };
}

// ---- Mappers ----

function snapshotToDto(row: {
  id: string;
  positionId: string;
  ts: Date;
  liquidity: string;
  amount0: string;
  amount1: string;
  unclaimedFeesUsd: number;
  valueUsd: number;
  inRange: boolean;
  ilPct: number;
}): PositionSnapshotDto {
  return {
    id: row.id,
    positionId: row.positionId,
    ts: row.ts.getTime(),
    liquidity: row.liquidity,
    amount0: row.amount0,
    amount1: row.amount1,
    unclaimedFeesUsd: row.unclaimedFeesUsd,
    valueUsd: row.valueUsd,
    inRange: row.inRange,
    ilPct: row.ilPct,
  };
}

function configToDto(row: {
  positionId: string;
  enabled: boolean;
  rebalanceAfterHrs: number;
  compoundMinUsd: number;
  maxSlippagePct: number;
  stopLossIlPct: number | null;
  updatedAt: Date;
}): StrategyConfigDto {
  return {
    positionId: row.positionId,
    enabled: row.enabled,
    rebalanceAfterHrs: row.rebalanceAfterHrs,
    compoundMinUsd: row.compoundMinUsd,
    maxSlippagePct: row.maxSlippagePct,
    stopLossIlPct: row.stopLossIlPct,
    updatedAt: row.updatedAt.getTime(),
  };
}

function actionToDto(row: {
  id: string;
  positionId: string;
  ts: Date;
  type: StrategyActionType;
  status: StrategyActionStatus;
  txHash: string | null;
  detailsJson: string;
}): StrategyActionDto {
  return {
    id: row.id,
    positionId: row.positionId,
    ts: row.ts.getTime(),
    type: row.type,
    status: row.status,
    txHash: row.txHash,
    detailsJson: row.detailsJson,
  };
}

function notificationToDto(row: {
  owner: string;
  telegramChatId: string | null;
  enabled: boolean;
  onRebalance: boolean;
  onCompound: boolean;
  onStopLoss: boolean;
  onFailure: boolean;
  onOutOfRangeHrs: number | null;
  updatedAt: Date;
}): NotificationSettingDto {
  return {
    owner: row.owner,
    telegramChatId: row.telegramChatId,
    enabled: row.enabled,
    onRebalance: row.onRebalance,
    onCompound: row.onCompound,
    onStopLoss: row.onStopLoss,
    onFailure: row.onFailure,
    onOutOfRangeHrs: row.onOutOfRangeHrs,
    updatedAt: row.updatedAt.getTime(),
  };
}
