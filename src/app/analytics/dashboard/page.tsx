"use client";

import { useEffect, useState } from "react";
import type {
  AnalyticsDashboardDto,
  HealthSummaryDto,
  EmergencyStopDto,
  MainnetPolicySettingDto,
  PendingApprovalDto,
} from "@/shared/types";
import { CHAINS, chainById } from "@/shared/chains";

export default function AnalyticsDashboardPage() {
  const [dashboard, setDashboard] = useState<AnalyticsDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [emergencyStop, setEmergencyStop] = useState<EmergencyStopDto | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalDto[]>([]);
  const [policies, setPolicies] = useState<MainnetPolicySettingDto[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<MainnetPolicySettingDto | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [dashRes, approvalsRes, policiesRes, stopRes] = await Promise.all([
        fetch("/api/analytics/dashboard"),
        fetch("/api/analytics/approvals/pending"),
        fetch("/api/analytics/policies"),
        fetch("/api/analytics/emergency-stop"),
      ]);

      const dash = await dashRes.json();
      const approvals = await approvalsRes.json();
      const policies = await policiesRes.json();
      const stop = await stopRes.json();

      setDashboard(dash);
      setPendingApprovals(approvals.approvals || []);
      setPolicies(policies.policies || []);
      setEmergencyStop(stop);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleEmergencyStop() {
    const newActive = !emergencyStop?.active;
    const reason = prompt(newActive ? "Enter reason for emergency stop:" : undefined);
    
    if (newActive && !reason) return;

    try {
      await fetch("/api/analytics/emergency-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive, reason: newActive ? reason : undefined }),
      });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle emergency stop:", err);
      alert("Failed to update emergency stop");
    }
  }

  async function handleApproval(actionId: string, approved: boolean) {
    const reason = !approved ? prompt("Enter rejection reason:") : undefined;
    if (!approved && !reason) return;

    try {
      await fetch("/api/analytics/approvals/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, approve: approved, reason }),
      });
      await loadData();
    } catch (err) {
      console.error("Failed to process approval:", err);
      alert("Failed to process approval");
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <button
          onClick={() => loadData()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {/* Emergency Stop Banner */}
      <div className={`p-4 rounded-lg ${emergencyStop?.active ? "bg-red-100 border border-red-400" : "bg-green-100 border border-green-400"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`font-bold ${emergencyStop?.active ? "text-red-800" : "text-green-800"}`}>
              {emergencyStop?.active ? "🛑 EMERGENCY STOP ACTIVE" : "✅ System Normal"}
            </h3>
            {emergencyStop?.active && emergencyStop.reason && (
              <p className="text-red-700 mt-1">Reason: {emergencyStop.reason}</p>
            )}
          </div>
          <button
            onClick={toggleEmergencyStop}
            className={`px-4 py-2 rounded-lg font-medium ${
              emergencyStop?.active
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {emergencyStop?.active ? "Resume" : "Stop Engine"}
          </button>
        </div>
      </div>

      {/* Health Metrics */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {dashboard.health.map((health) => (
            <HealthCard key={health.chainId} health={health} />
          ))}
        </div>
      )}

      {/* Position & Action Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PositionStats positions={dashboard.positions} />
          <ActionStats actions={dashboard.actions} />
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Approvals</h2>
          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={() => handleApproval(approval.id, true)}
                onReject={() => handleApproval(approval.id, false)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Policy Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Mainnet Trading Policies</h2>
        <div className="space-y-4">
          {policies.map((policy) => (
            <PolicyCard
              key={policy.chainId}
              policy={policy}
              onEdit={() => setSelectedPolicy(policy)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthCard({ health }: { health: HealthSummaryDto }) {
  const chain = chainById(health.chainId);
  const chainName = chain?.name || `Chain ${health.chainId}`;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{chainName}</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Runs:</span>
          <span className="font-medium">{health.totalRuns}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Success Rate:</span>
          <span className={`font-medium ${health.successRate >= 95 ? "text-green-600" : "text-yellow-600"}`}>
            {health.successRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Avg Duration:</span>
          <span className="font-medium">{health.avgDurationMs.toFixed(0)}ms</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Actions:</span>
          <span className="font-medium">{health.totalActions}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Errors:</span>
          <span className={`font-medium ${health.totalErrors > 0 ? "text-red-600" : ""}`}>
            {health.totalErrors}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Gas Spent:</span>
          <span className="font-medium">${health.totalGasUsd.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function PositionStats({ positions }: { positions: any }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Position Statistics</h2>
      <div className="space-y-4">
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <span className="text-gray-600">Total Positions</span>
          <span className="text-2xl font-bold">{positions.total}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <span className="text-gray-600 block text-sm">In Range</span>
            <span className="text-xl font-bold text-green-600">{positions.inRange}</span>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <span className="text-gray-600 block text-sm">Out of Range</span>
            <span className="text-xl font-bold text-red-600">{positions.outOfRange}</span>
          </div>
        </div>
        <div className="space-y-2 pt-4 border-t">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Value:</span>
            <span className="font-bold">${positions.totalValueUsd.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Fees:</span>
            <span className="font-bold text-green-600">+${positions.totalFeesUsd.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionStats({ actions }: { actions: any }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Action Statistics</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <span className="text-gray-600 block text-sm">Today</span>
            <span className="text-2xl font-bold text-blue-600">{actions.today}</span>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <span className="text-gray-600 block text-sm">This Week</span>
            <span className="text-2xl font-bold text-purple-600">{actions.week}</span>
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <span className="text-gray-600 block text-sm mb-2">Success Rate</span>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${actions.successRate}%` }}
              />
            </div>
            <span className="text-lg font-bold">{actions.successRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: PendingApprovalDto;
  onApprove: () => void;
  onReject: () => void;
}) {
  const chain = chainById(approval.chainId);
  const chainName = chain?.name || `Chain ${approval.chainId}`;

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-yellow-50">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-sm font-medium text-gray-900">{chainName}</span>
          <span className="mx-2 text-gray-400">•</span>
          <span className="text-sm text-gray-600">{approval.actionType}</span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(approval.createdAt).toLocaleString()}
        </span>
      </div>
      {approval.position && (
        <div className="text-sm text-gray-600 mb-3">
          Position: {approval.position.tokenId}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function PolicyCard({
  policy,
  onEdit,
}: {
  policy: MainnetPolicySettingDto;
  onEdit: () => void;
}) {
  const chain = chainById(policy.chainId);
  const chainName = chain?.name || `Chain ${policy.chainId}`;

  return (
    <div className={`p-4 border rounded-lg ${policy.enabled ? "border-green-300 bg-green-50" : "border-gray-300 bg-gray-50"}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900">{chainName}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${policy.enabled ? "bg-green-600 text-white" : "bg-gray-600 text-white"}`}>
              {policy.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <div>Human Approval: {policy.requireHumanApproval ? "Required" : "Not Required"}</div>
            <div>Max Gas: ${policy.maxGasUsd}</div>
            <div>Max Daily Volume: ${policy.maxDailyVolumeUsd.toLocaleString()}</div>
            <div>Allowed Actions: {policy.allowedActions.join(", ")}</div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
        >
          Edit
        </button>
      </div>
    </div>
  );
}