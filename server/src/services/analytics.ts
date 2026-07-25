// server/src/services/analytics.ts
// v1.2: Analytics reads from DB history (PositionSnapshot table).
// v1.6: transparently merges PositionDailySnapshot aggregates (retention)
// with raw hourly snapshots — long windows keep working after old raw
// snapshots are rolled up and deleted.

import type {
  AnalyticsPointDto,
  AnalyticsResponse,
  AnalyticsSummaryDto,
  PositionSnapshotDto,
} from "../../../shared/types";
import {
  getSnapshotSeries,
  getTotalPositionCount,
  getTotalSnapshotCount,
  getLatestSnapshotsAll,
} from "../lib/repo";
import { getDb, hasDatabase } from "../lib/db";

/**
 * Build the analytics response from persisted snapshots.
 * When the DB is not configured, returns an empty (zeroed) response.
 */
export async function getAnalytics(
  hours = 168
): Promise<AnalyticsResponse> {
  if (!hasDatabase()) {
    return { summary: emptySummary(), series: [] };
  }

  const [latest, series, dailyPoints, snapshotCount, totalPositions] =
    await Promise.all([
      getLatestSnapshotsAll(),
      getSnapshotSeries(hours),
      getDailySeriesPoints(hours),
      getTotalSnapshotCount(),
      getTotalPositionCount(),
    ]);

  const summary = buildSummary(latest, snapshotCount, totalPositions);
  const hourlyAgg = aggregateSeries(series);

  // v1.6: prepend daily aggregates that predate the earliest raw snapshot —
  // the two sources never overlap because retention deletes raw rows it
  // rolled up.
  const earliestHourly = hourlyAgg.length ? hourlyAgg[0].ts : Infinity;
  const merged = [
    ...dailyPoints.filter((p) => p.ts < earliestHourly),
    ...hourlyAgg,
  ];

  return { summary, series: merged };
}

/**
 * v1.6: Read PositionDailySnapshot rows in the window and shape them as
 * AnalyticsPointDto (one point per day, summed across positions).
 */
async function getDailySeriesPoints(
  hours: number
): Promise<AnalyticsPointDto[]> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await db.positionDailySnapshot.findMany({
    where: { day: { gte: since } },
    orderBy: { day: "asc" },
  });
  if (rows.length === 0) return [];

  const buckets = new Map<
    number,
    { totalValue: number; totalFees: number; ilSum: number; count: number }
  >();
  for (const r of rows) {
    const ts = r.day.getTime();
    const b = buckets.get(ts);
    if (b) {
      b.totalValue += r.avgValueUsd;
      b.totalFees += r.avgUnclaimedFeesUsd;
      b.ilSum += r.avgIlPct;
      b.count++;
    } else {
      buckets.set(ts, {
        totalValue: r.avgValueUsd,
        totalFees: r.avgUnclaimedFeesUsd,
        ilSum: r.avgIlPct,
        count: 1,
      });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, agg]) => ({
      ts,
      totalValueUsd: agg.totalValue,
      totalFeesUsd: agg.totalFees,
      avgIlPct: agg.count > 0 ? agg.ilSum / agg.count : 0,
    }));
}

function emptySummary(): AnalyticsSummaryDto {
  return {
    totalValueUsd: 0,
    totalFeesUsd: 0,
    avgFeeApr: 0,
    avgIlPct: 0,
    inRangeCount: 0,
    totalPositions: 0,
    snapshotCount: 0,
  };
}

function buildSummary(
  latest: PositionSnapshotDto[],
  snapshotCount: number,
  totalPositions: number
): AnalyticsSummaryDto {
  if (latest.length === 0) return emptySummary();

  const totalValueUsd = sum(latest.map((s) => s.valueUsd));
  const totalFeesUsd = sum(latest.map((s) => s.unclaimedFeesUsd));
  const avgIlPct =
    sum(latest.map((s) => s.ilPct)) / latest.length;
  const inRangeCount = latest.filter((s) => s.inRange).length;

  // Fee APR from the latest snapshots: (fees24h * 365 / value) * 100.
  // We approximate fees24h from unclaimedFeesUsd / max(days, 1).
  const avgFeeApr = totalValueUsd > 0
    ? ((totalFeesUsd * 365) / totalValueUsd) * 100
    : 0;

  return {
    totalValueUsd,
    totalFeesUsd,
    avgFeeApr,
    avgIlPct,
    inRangeCount,
    totalPositions,
    snapshotCount,
  };
}

/**
 * Group snapshots by hourly bucket and sum value + fees per bucket.
 */
function aggregateSeries(
  snapshots: PositionSnapshotDto[]
): AnalyticsPointDto[] {
  if (snapshots.length === 0) return [];

  const buckets = new Map<number, {
    totalValue: number;
    totalFees: number;
    ilSum: number;
    count: number;
  }>();

  for (const s of snapshots) {
    // Bucket to the nearest hour.
    const bucketTs = Math.floor(s.ts / 3_600_000) * 3_600_000;
    const existing = buckets.get(bucketTs);
    if (existing) {
      existing.totalValue += s.valueUsd;
      existing.totalFees += s.unclaimedFeesUsd;
      existing.ilSum += s.ilPct;
      existing.count++;
    } else {
      buckets.set(bucketTs, {
        totalValue: s.valueUsd,
        totalFees: s.unclaimedFeesUsd,
        ilSum: s.ilPct,
        count: 1,
      });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, agg]) => ({
      ts,
      totalValueUsd: agg.totalValue,
      totalFeesUsd: agg.totalFees,
      avgIlPct: agg.count > 0 ? agg.ilSum / agg.count : 0,
    }));
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
