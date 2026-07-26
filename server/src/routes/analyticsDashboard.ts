// server/src/routes/analyticsDashboard.ts
// v1.9: Analytics dashboard API routes

import { FastifyInstance, FastifyRequest } from "fastify";
import {
  analyticsDashboardService,
} from "../services/analyticsDashboard";
import { emergencyStopService } from "../services/emergencyStop";
import { mainnetPolicyService } from "../services/mainnetPolicy";
import type {
  AnalyticsDashboardDto,
  EmergencyStopInput,
  UpdatePolicyInput,
  ApprovalActionInput,
  PendingApprovalDto,
  MainnetPolicySettingDto,
} from "../../../shared/types";

export async function analyticsDashboardRoutes(fastify: FastifyInstance) {
  // Get full analytics dashboard
  fastify.get<{ Querystring: { owner?: string } }>(
    "/api/analytics/dashboard",
    async (req, reply) => {
      const { owner } = req.query;
      const dashboard = await analyticsDashboardService.getDashboard(owner);
      return reply.send(dashboard);
    }
  );

  // Get health metrics for a specific chain
  fastify.get<{ Querystring: { chainId: string; hours?: string } }>(
    "/api/analytics/health",
    async (req, reply) => {
      const chainId = parseInt(req.query.chainId);
      const hours = req.query.hours ? parseInt(req.query.hours) : 24;
      const metrics = await analyticsDashboardService.getHealthMetrics(
        chainId,
        hours
      );
      return reply.send(metrics);
    }
  );

  // Get pending approvals
  fastify.get<{ Querystring: { owner?: string } }>(
    "/api/analytics/approvals/pending",
    async (req, reply) => {
      const { owner } = req.query;
      const approvals = await analyticsDashboardService.getPendingApprovals(
        owner
      );
      return reply.send({ approvals });
    }
  );

  // Get mainnet policies
  fastify.get(
    "/api/analytics/policies",
    async (req, reply) => {
      const policies = await analyticsDashboardService.getMainnetPolicies();
      return reply.send({ policies });
    }
  );

  // Update mainnet policy
  fastify.post<{ Body: UpdatePolicyInput }>(
    "/api/analytics/policies/update",
    async (req, reply) => {
      const body = req.body;
      await mainnetPolicyService.setPolicy(body.chainId, body);
      return reply.send({ success: true });
    }
  );

  // Get emergency stop state
  fastify.get(
    "/api/analytics/emergency-stop",
    async (req, reply) => {
      const state = await emergencyStopService.getState();
      return reply.send(state);
    }
  );

  // Update emergency stop (activate/deactivate)
  fastify.post<{ Body: EmergencyStopInput }>(
    "/api/analytics/emergency-stop",
    async (req, reply) => {
      const body = req.body;
      // Get owner from session (simplified for now)
      const updatedBy = req.headers["x-owner"] as string || "unknown";
      const state = await emergencyStopService.update(body, updatedBy);
      return reply.send(state);
    }
  );

  // Approve or reject pending action
  fastify.post<{ Body: ApprovalActionInput }>(
    "/api/analytics/approvals/action",
    async (req, reply) => {
      const { actionId, approve, reason } = req.body;
      const updatedBy = req.headers["x-owner"] as string || "unknown";

      if (approve) {
        await mainnetPolicyService.approveAction(actionId, updatedBy);
      } else {
        await mainnetPolicyService.rejectAction(
          actionId,
          reason ?? "No reason provided",
          updatedBy
        );
      }

      return reply.send({ success: true });
    }
  );

  // Get all policies from mainnet policy service
  fastify.get(
    "/api/analytics/policies/all",
    async (req, reply) => {
      const policies = await mainnetPolicyService.getAllPolicies();
      return reply.send({ policies });
    }
  );
}