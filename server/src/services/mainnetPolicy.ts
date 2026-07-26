// server/src/services/mainnetPolicy.ts
// v1.9: Mainnet approval policy service — guardrails for autonomous trading

import { PrismaClient } from "@prisma/client";
import { CHAINS } from "../../../shared/chains";
import type { StrategyActionType } from "../../../shared/types";

const db = new PrismaClient();

export interface ApprovalPolicyConfig {
  enabled: boolean;
  requireHumanApproval: boolean;
  maxGasUsd: number;
  maxDailyVolumeUsd: number;
  allowedActions: StrategyActionType[];
  requireLiquidityCheck: boolean;
  requireRangeSanity: boolean;
  pauseOnHighFailureRate: boolean;
  failureRateThreshold: number; // percentage
}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
  policyName?: string;
}

export class MainnetPolicyService {
  private static instance: MainnetPolicyService;
  private policies: Map<number, ApprovalPolicyConfig> = new Map();
  private failureCounts: Map<number, number[]> = new Map(); // chainId -> timestamps of failures

  static getInstance(): MainnetPolicyService {
    if (!MainnetPolicyService.instance) {
      MainnetPolicyService.instance = new MainnetPolicyService();
    }
    return MainnetPolicyService.instance;
  }

  async initialize() {
    // Load policies from DB or use defaults
    const policySettings = await db.mainnetPolicySetting.findMany();
    
    if (policySettings.length === 0) {
      // Create default policy for all chains
      for (const [slug, chain] of Object.entries(CHAINS)) {
        await db.mainnetPolicySetting.create({
          data: {
            chainId: chain.chainId,
            enabled: false, // OFF by default for safety
            requireHumanApproval: true,
            maxGasUsd: 50,
            maxDailyVolumeUsd: 10000,
            allowedActions: "COMPOUND,REBALANCE",
            requireLiquidityCheck: true,
            requireRangeSanity: true,
            pauseOnHighFailureRate: true,
            failureRateThreshold: 30, // 30% failure rate triggers pause
          },
        });
      }
    }

    // Load into memory
    const policies = await db.mainnetPolicySetting.findMany();
    for (const policy of policies) {
      this.policies.set(policy.chainId, {
        enabled: policy.enabled,
        requireHumanApproval: policy.requireHumanApproval,
        maxGasUsd: policy.maxGasUsd,
        maxDailyVolumeUsd: policy.maxDailyVolumeUsd,
        allowedActions: policy.allowedActions.split(",") as StrategyActionType[],
        requireLiquidityCheck: policy.requireLiquidityCheck,
        requireRangeSanity: policy.requireRangeSanity,
        pauseOnHighFailureRate: policy.pauseOnHighFailureRate,
        failureRateThreshold: policy.failureRateThreshold,
      });
    }

    console.log(`[MainnetPolicy] Loaded ${this.policies.size} policies`);
  }

  getPolicy(chainId: number): ApprovalPolicyConfig | undefined {
    return this.policies.get(chainId);
  }

  async setPolicy(chainId: number, policy: Partial<ApprovalPolicyConfig>) {
    const existing = this.policies.get(chainId);
    if (!existing) {
      throw new Error(`No policy found for chain ${chainId}`);
    }

    const updated = { ...existing, ...policy };
    this.policies.set(chainId, updated);

    // Persist to DB
    await db.mainnetPolicySetting.update({
      where: { chainId },
      data: {
        enabled: updated.enabled,
        requireHumanApproval: updated.requireHumanApproval,
        maxGasUsd: updated.maxGasUsd,
        maxDailyVolumeUsd: updated.maxDailyVolumeUsd,
        allowedActions: updated.allowedActions.join(","),
        requireLiquidityCheck: updated.requireLiquidityCheck,
        requireRangeSanity: updated.requireRangeSanity,
        pauseOnHighFailureRate: updated.pauseOnHighFailureRate,
        failureRateThreshold: updated.failureRateThreshold,
      },
    });

    console.log(`[MainnetPolicy] Updated policy for chain ${chainId}`);
  }

  async checkApproval(
    chainId: number,
    actionType: StrategyActionType,
    gasCostUsd: number,
    owner: string
  ): Promise<ApprovalDecision> {
    const policy = this.policies.get(chainId);
    
    // No policy = auto-approve (e.g., testnet)
    if (!policy) {
      return { approved: true };
    }

    // Policy disabled = auto-reject
    if (!policy.enabled) {
      return {
        approved: false,
        reason: "Mainnet policy is disabled for this chain",
        policyName: "policy_disabled",
      };
    }

    // Check if action type is allowed
    if (!policy.allowedActions.includes(actionType)) {
      return {
        approved: false,
        reason: `Action type ${actionType} is not allowed`,
        policyName: "action_not_allowed",
      };
    }

    // Check gas cost limit
    if (gasCostUsd > policy.maxGasUsd) {
      return {
        approved: false,
        reason: `Gas cost $${gasCostUsd.toFixed(2)} exceeds limit $${policy.maxGasUsd}`,
        policyName: "gas_limit_exceeded",
      };
    }

    // Check daily volume limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayActions = await db.strategyAction.count({
      where: {
        chainId,
        status: "EXECUTED",
        ts: { gte: today },
      },
    });
    
    // Simplified: use action count as proxy for volume
    // In production, you'd sum actual transaction values
    if (todayActions * 100 > policy.maxDailyVolumeUsd) { // rough estimate
      return {
        approved: false,
        reason: `Daily action volume exceeds limit`,
        policyName: "volume_limit_exceeded",
      };
    }

    // Check high failure rate
    if (policy.pauseOnHighFailureRate) {
      const failureRate = this.calculateFailureRate(chainId);
      if (failureRate >= policy.failureRateThreshold) {
        return {
          approved: false,
          reason: `High failure rate (${failureRate.toFixed(1)}%) exceeds threshold ${policy.failureRateThreshold}%`,
          policyName: "high_failure_rate",
        };
      }
    }

    // Human approval required (if not overridden)
    if (policy.requireHumanApproval) {
      // Check if there's an approved action record
      const approved = await db.strategyAction.findFirst({
        where: {
          chainId,
          type: actionType,
          status: "APPROVED",
          ts: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Approved within last 24h
        },
      });

      if (!approved) {
        return {
          approved: false,
          reason: "Human approval required for mainnet trading",
          policyName: "require_human_approval",
        };
      }
    }

    return { approved: true };
  }

  recordFailure(chainId: number) {
    const now = Date.now();
    const failures = this.failureCounts.get(chainId) ?? [];
    failures.push(now);
    
    // Keep only failures from last hour
    const oneHourAgo = now - 60 * 60 * 1000;
    const recent = failures.filter(t => t > oneHourAgo);
    this.failureCounts.set(chainId, recent);
  }

  private calculateFailureRate(chainId: number): number {
    const failures = this.failureCounts.get(chainId) ?? [];
    if (failures.length === 0) return 0;

    // Count total failures in last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentFailures = failures.filter(t => t > oneHourAgo).length;
    
    // Simplified: assume 10 actions per hour for calculation
    // In production, track both successes and failures
    return (recentFailures / 10) * 100;
  }

  async requestApproval(
    chainId: number,
    actionType: StrategyActionType,
    positionId: string,
    owner: string,
    details: any
  ) {
    // Create a pending approval request
    return await db.strategyAction.create({
      data: {
        chainId,
        positionId,
        type: actionType,
        status: "PENDING_APPROVAL",
        detailsJson: JSON.stringify(details),
        ts: new Date(),
      },
    });
  }

  async approveAction(actionId: string, approvedBy: string) {
    return await db.strategyAction.update({
      where: { id: actionId },
      data: {
        status: "APPROVED",
        detailsJson: JSON.stringify({ approvedAt: new Date().toISOString(), approvedBy }),
      },
    });
  }

  async rejectAction(actionId: string, reason: string, rejectedBy: string) {
    return await db.strategyAction.update({
      where: { id: actionId },
      data: {
        status: "REJECTED",
        detailsJson: JSON.stringify({ rejectedAt: new Date().toISOString(), rejectedBy, reason }),
      },
    });
  }

  async getPendingApprovals(owner?: string) {
    const where: any = { status: "PENDING_APPROVAL" };
    
    return await db.strategyAction.findMany({
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
  }

  async getAllPolicies() {
    return await db.mainnetPolicySetting.findMany();
  }
}

export const mainnetPolicyService = MainnetPolicyService.getInstance();