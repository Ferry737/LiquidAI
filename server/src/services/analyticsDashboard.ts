// server/src/services/analyticsDashboard.ts
// v1.9: Comprehensive analytics dashboard service

import { PrismaClient } from "@prisma/client";
import type {
  AnalyticsDashboardDto,
  HealthSummaryDto,
  MainnetPolicySettingDto,
  PendingApprovalDto,
} from "../../../shared/types";

const db = new PrismaClient();

export class AnalyticsDashboardService {
  private static instance: AnalyticsDashboardService;

  static getInstance(): AnalyticsDashboardService {
    if (!AnalyticsDashboardService.instance) {
      AnalyticsDashboardService.instance = new AnalyticsDashboardService();
    }
    return AnalyticsDashboardService.instance;
  }

  async getDashboard(owner?: string): Promise<AnalyticsDashboardDto> {
    const [health, positions, actions, emergencyStop] = await Promise.all([
      this.getHealthSummary(),
      this.getPositionSummary(owner),
      this.getActionSummary(owner),
      this.getEmergencyStopState(),
    ]);

    return {
      health,
      positions,
      actions,
      emergencyStop,
    };
  }

  async getHealthSummary(): Promise<HealthSummaryDto[]> {
    // Get all chains
    const { CHAINS } = await import("../../../shared/chains");
    const chainIds = Object.values(CHAINS).map(c => c.chainId);

    const summaries: HealthSummaryDto[] = [];

    for (const chainId of chainIds) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const healthData = await db.engineHealth.findMany({
        where: {
          chainId,
          timestamp: { gte: oneDayAgo },
        },
        orderBy: { timestamp: "desc" },
      });

      if (healthData.length === 0) {
        summaries.push({
          chainId,
          totalRuns: 0,
          successRate: 100,
          avgDurationMs: 0,
          totalActions: 0,
          totalErrors: 0,
          totalGasUsd: 0,
          lastRunTs: null,
        });
        continue;
      }

      const totalRuns = healthData.length;
      const successCount = healthData.filter(h => h.success).length;
      const successRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 100;
      const avgDurationMs =
        totalRuns > 0
          ? healthData.reduce((sum, h) => sum + h.durationMs, 0) / totalRuns
          : 0;
      const totalActions = healthData.reduce((sum, h) => sum + h.actionCount, 0);
      const totalErrors = healthData.reduce((sum, h) => sum + h.errorCount, 0);
      const totalGasUsd = healthData.reduce((sum, h) => sum + (h.gasUsd ?? 0), 0);
      const lastRunTs = healthData[0].timestamp.getTime();

      summaries.push({
        chainId,
        totalRuns,
        successRate,
        avgDurationMs,
        totalActions,
        totalErrors,
        totalGasUsd,
        lastRunTs,
      });
    }

    return summaries;
  }

  async getPositionSummary(owner?: string): Promise<{
    total: number;
    inRange: number;
    outOfRange: number;
    totalValueUsd: number;
    totalFeesUsd: number;
  }> {
    const where: any = { closedAt: null };
    if (owner) {
      where.owner = owner;
    }

    const positions = await db.position.findMany({
      where,
      include: {
        snapshots: {
          orderBy: { ts: "desc" },
          take: 1,
        },
      },
    });

    const total = positions.length;
    const inRange = positions.filter(p => p.snapshots[0]?.inRange ?? false).length;
    const outOfRange = total - inRange;

    const totalValueUsd = positions.reduce(
      (sum, p) => sum + (p.snapshots[0]?.valueUsd ?? 0),
      0
    );
    const totalFeesUsd = positions.reduce(
      (sum, p) => sum + (p.snapshots[0]?.unclaimedFeesUsd ?? 0),
      0
    );

    return {
      total,
      inRange,
      outOfRange,
      totalValueUsd,
      totalFeesUsd,
    };
  }

  async getActionSummary(owner?: string): Promise<{
    today: number;
    week: number;
    successRate: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const where: any = {
      ts: { gte: weekAgo },
    };

    if (owner) {
      // Join with positions to filter by owner
      const positionIds = await db.position
        .findMany({ where: { owner }, select: { id: true } })
        .then(positions => positions.map(p => p.id));
      where.positionId = { in: positionIds };
    }

    const actions = await db.strategyAction.findMany({ where });

    const todayActions = actions.filter(a => a.ts >= today);
    const weekActions = actions;
    const successfulActions = weekActions.filter(a => a.status === "EXECUTED");

    const todayCount = todayActions.length;
    const weekCount = weekActions.length;
    const successRate =
      weekCount > 0 ? (successfulActions.length / weekCount) * 100 : 100;

    return {
      today: todayCount,
      week: weekCount,
      successRate,
    };
  }

  async getEmergencyStopState() {
    const state = await db.emergencyStop.findUnique({
      where: { id: "singleton" },
    });

    if (!state) {
      return {
        active: false,
        updatedAt: Date.now(),
      };
    }

    return {
      active: state.active,
      reason: state.reason ?? undefined,
      stoppedAt: state.stoppedAt?.getTime() ?? undefined,
      stoppedBy: state.stoppedBy ?? undefined,
      updatedAt: state.updatedAt.getTime(),
    };
  }

  async recordEngineHealth(
    chainId: number,
    runId: string,
    success: boolean,
    durationMs: number,
    actionCount: number,
    errorCount: number,
    gasUsd?: number
  ) {
    return await db.engineHealth.create({
      data: {
        chainId,
        runId,
        success,
        durationMs,
        actionCount,
        errorCount,
        gasUsd,
        timestamp: new Date(),
      },
    });
  }

  async getHealthMetrics(chainId: number, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return await db.engineHealth.findMany({
      where: {
        chainId,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: "desc" },
    });
  }

  async getPendingApprovals(owner?: string): Promise<PendingApprovalDto[]> {
    const where: any = { status: "PENDING_APPROVAL" };

    if (owner) {
      const positionIds = await db.position
        .findMany({ where: { owner }, select: { id: true } })
        .then(positions => positions.map(p => p.id));
      where.positionId = { in: positionIds };
    }

    const actions = await db.strategyAction.findMany({
      where,
      orderBy: { ts: "desc" },
      include: {
        position: {
          select: {
            pool: true,
            tokenId: true,
            tickLower: true,
            tickUpper: true,
          },
        },
      },
    });

    return actions.map(a => ({
      id: a.id,
      positionId: a.positionId,
      chainId: a.chainId,
      actionType: a.type as any,
      createdAt: a.ts.getTime(),
      detailsJson: a.detailsJson,
      position: a.position
        ? {
            pool: a.position.pool,
            tokenId: a.position.tokenId,
            tickLower: a.position.tickLower,
            tickUpper: a.position.tickUpper,
          }
        : undefined,
    }));
  }

  async getMainnetPolicies(): Promise<MainnetPolicySettingDto[]> {
    const policies = await db.mainnetPolicySetting.findMany();

    return policies.map(p => ({
      id: p.id,
      chainId: p.chainId,
      enabled: p.enabled,
      requireHumanApproval: p.requireHumanApproval,
      maxGasUsd: p.maxGasUsd,
      maxDailyVolumeUsd: p.maxDailyVolumeUsd,
      allowedActions: p.allowedActions.split(",") as any[],
      requireLiquidityCheck: p.requireLiquidityCheck,
      requireRangeSanity: p.requireRangeSanity,
      pauseOnHighFailureRate: p.pauseOnHighFailureRate,
      failureRateThreshold: p.failureRateThreshold,
      updatedAt: p.updatedAt.getTime(),
    }));
  }
}

export const analyticsDashboardService = AnalyticsDashboardService.getInstance();