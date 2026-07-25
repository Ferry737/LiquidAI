// server/src/services/retention.ts
// v1.6: Data retention — nightly job aggregates PositionSnapshots older than
// 90 days into PositionDailySnapshot rows, then deletes the raw snapshots.
// PoolHourData older than 180 days is pruned per (chainId, poolId).
//
// The aggregation math is pure (aggregateSnapshotsToDaily) so it is fully
// unit-testable without a DB.

import { getDb, hasDatabase } from "../lib/db";

export const SNAPSHOT_RETENTION_DAYS = 90;
export const POOL_HOUR_RETENTION_DAYS = 180;

const DAY_MS = 86_400_000;

// ---- Pure aggregation math ----

export interface RawSnapshotForAggregation {
  positionId: string;
  chainId: number;
  ts: number; // unix ms
  valueUsd: number;
  unclaimedFeesUsd: number;
  ilPct: number;
  inRange: boolean;
}

export interface DailyAggregate {
  positionId: string;
  chainId: number;
  /** UTC midnight, unix ms. */
  day: number;
  avgValueUsd: number;
  minValueUsd: number;
  maxValueUsd: number;
  avgUnclaimedFeesUsd: number;
  maxUnclaimedFeesUsd: number;
  avgIlPct: number;
  inRangeRatio: number;
  sampleCount: number;
}

/** UTC midnight bucket for a timestamp. */
export function utcDayStart(tsMs: number): number {
  return Math.floor(tsMs / DAY_MS) * DAY_MS;
}

/**
 * Aggregate raw snapshots into one row per (positionId, UTC day).
 * Pure function — deterministic, no I/O.
 */
export function aggregateSnapshotsToDaily(
  snapshots: RawSnapshotForAggregation[]
): DailyAggregate[] {
  const groups = new Map<string, RawSnapshotForAggregation[]>();
  for (const s of snapshots) {
    const key = `${s.positionId}:${utcDayStart(s.ts)}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  const out: DailyAggregate[] = [];
  groups.forEach((list) => {
    const day = utcDayStart(list[0].ts);
    const n = list.length;
    const values = list.map((s) => s.valueUsd);
    const fees = list.map((s) => s.unclaimedFeesUsd);
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    out.push({
      positionId: list[0].positionId,
      chainId: list[0].chainId,
      day,
      avgValueUsd: sum(values) / n,
      minValueUsd: Math.min(...values),
      maxValueUsd: Math.max(...values),
      avgUnclaimedFeesUsd: sum(fees) / n,
      maxUnclaimedFeesUsd: Math.max(...fees),
      avgIlPct: sum(list.map((s) => s.ilPct)) / n,
      inRangeRatio: list.filter((s) => s.inRange).length / n,
      sampleCount: n,
    });
  });

  return out.sort(
    (a, b) => a.day - b.day || a.positionId.localeCompare(b.positionId)
  );
}

// ---- DB orchestration ----

export interface RetentionRunResult {
  aggregatedDays: number;
  snapshotsDeleted: number;
  poolHourRowsDeleted: number;
}

/**
 * Run the retention pass:
 * 1. Find PositionSnapshots older than SNAPSHOT_RETENTION_DAYS.
 * 2. Aggregate to PositionDailySnapshot (upsert — idempotent re-runs).
 * 3. Delete the aggregated raw snapshots.
 * 4. Prune PoolHourData older than POOL_HOUR_RETENTION_DAYS.
 */
export async function runRetention(
  now = Date.now()
): Promise<RetentionRunResult> {
  if (!hasDatabase()) {
    return { aggregatedDays: 0, snapshotsDeleted: 0, poolHourRowsDeleted: 0 };
  }
  const db = getDb();
  const snapshotCutoff = new Date(now - SNAPSHOT_RETENTION_DAYS * DAY_MS);
  const poolHourCutoff = new Date(now - POOL_HOUR_RETENTION_DAYS * DAY_MS);

  // 1. Load old snapshots (bounded batches to keep memory flat).
  const rows = await db.positionSnapshot.findMany({
    where: { ts: { lt: snapshotCutoff } },
    orderBy: { ts: "asc" },
    take: 50_000,
  });

  let aggregatedDays = 0;
  let snapshotsDeleted = 0;

  if (rows.length > 0) {
    // 2. Aggregate.
    const aggregates = aggregateSnapshotsToDaily(
      rows.map((r) => ({
        positionId: r.positionId,
        chainId: r.chainId,
        ts: r.ts.getTime(),
        valueUsd: r.valueUsd,
        unclaimedFeesUsd: r.unclaimedFeesUsd,
        ilPct: r.ilPct,
        inRange: r.inRange,
      }))
    );

    // Upsert daily rows in chunks of 50.
    for (let i = 0; i < aggregates.length; i += 50) {
      await Promise.all(
        aggregates.slice(i, i + 50).map((a) =>
          db.positionDailySnapshot.upsert({
            where: {
              positionId_day: {
                positionId: a.positionId,
                day: new Date(a.day),
              },
            },
            create: {
              positionId: a.positionId,
              chainId: a.chainId,
              day: new Date(a.day),
              avgValueUsd: a.avgValueUsd,
              minValueUsd: a.minValueUsd,
              maxValueUsd: a.maxValueUsd,
              avgUnclaimedFeesUsd: a.avgUnclaimedFeesUsd,
              maxUnclaimedFeesUsd: a.maxUnclaimedFeesUsd,
              avgIlPct: a.avgIlPct,
              inRangeRatio: a.inRangeRatio,
              sampleCount: a.sampleCount,
            },
            update: {
              avgValueUsd: a.avgValueUsd,
              minValueUsd: a.minValueUsd,
              maxValueUsd: a.maxValueUsd,
              avgUnclaimedFeesUsd: a.avgUnclaimedFeesUsd,
              maxUnclaimedFeesUsd: a.maxUnclaimedFeesUsd,
              avgIlPct: a.avgIlPct,
              inRangeRatio: a.inRangeRatio,
              sampleCount: a.sampleCount,
            },
          })
        )
      );
    }
    aggregatedDays = aggregates.length;

    // 3. Delete aggregated raw snapshots.
    const del = await db.positionSnapshot.deleteMany({
      where: { ts: { lt: snapshotCutoff } },
    });
    snapshotsDeleted = del.count;
  }

  // 4. Prune PoolHourData per (chainId, poolId) — a single ranged deleteMany
  // covers all groups since retention is uniform.
  const pruned = await db.poolHourData.deleteMany({
    where: { ts: { lt: poolHourCutoff } },
  });

  return {
    aggregatedDays,
    snapshotsDeleted,
    poolHourRowsDeleted: pruned.count,
  };
}
