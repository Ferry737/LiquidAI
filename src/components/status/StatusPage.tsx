// src/components/status/StatusPage.tsx
// v2.1: Dynamic health panel using client-side polling. Polls RPC, Subgraph,
// CoinGecko, and Telegram endpoints every 30 seconds. Shows real latency and
// connectivity status. No backend dependency.

"use client";

import { useStatus } from "@/hooks/useStatus";
import { useEventStream } from "@/hooks/useEventStream";
import { getEngineState } from "@/lib/local-storage";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { DependencyCheck } from "@/hooks/useStatus";

const PILL_STYLES: Record<string, string> = {
  ok: "bg-[#1F8A4C]/10 text-[#1F8A4C] border-[#1F8A4C]/30",
  degraded: "bg-[#B26A00]/10 text-[#B26A00] border-[#B26A00]/30",
  down: "bg-negative/10 text-negative border-negative/30",
};

const DOT_STYLES: Record<string, string> = {
  ok: "bg-[#1F8A4C]",
  degraded: "bg-amber-400",
  down: "bg-red-400",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        PILL_STYLES[status] ?? PILL_STYLES.down
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[status] ?? DOT_STYLES.down)} />
      {status}
    </span>
  );
}

function formatTs(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleString();
}

export function StatusPage() {
  const { data, isLoading } = useStatus();
  const [engineOverride, setEngineOverride] = useState(getEngineState());

  // Listen for engine status changes
  useEventStream({
    onEngineStatus: () => {
      setEngineOverride(getEngineState());
    },
  });

  return (
    <div className="space-y-8">
      {/* Global engine */}
      <Card className="mb-8 p-6" data-testid="engine-card">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-muted">
              Engine
            </div>
            <div className="mt-1 text-lg font-medium">
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : engineOverride.running ? (
                <span className="text-[#1F8A4C]">Running</span>
              ) : (
                <span className="text-negative">Stopped</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-muted">
              Mode
            </div>
            <div className="mt-1 text-lg font-medium">
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : engineOverride.dryRun ? (
                <span className="text-[#B26A00]">Dry run</span>
              ) : (
                <span className="text-[#1F8A4C]">Live</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-muted">
              Last Sync
            </div>
            <div className="mt-1 text-lg font-medium">
              {data ? formatTs(data.ts) : "—"}
            </div>
          </div>
        </div>
      </Card>

      {/* Dependencies */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-ink-muted">
        Dependencies — live checks every 30s
      </h2>
      <Card className="divide-y divide-ink/10 p-0" data-testid="dependency-list">
        {isLoading && (
          <div className="p-5">
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {data?.dependencies.map((dep: DependencyCheck) => (
          <div
            key={dep.name}
            className="flex items-center justify-between px-5 py-4"
            data-testid={`dep-${dep.name}`}
          >
            <div>
              <div className="text-sm font-medium text-ink">
                {dep.label}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {dep.status === "ok" || dep.status === "degraded"
                  ? `${dep.latencyMs}ms latency`
                  : ""}
                {dep.error ? ` · ${dep.error}` : ""}
                {` · checked ${formatTs(dep.lastCheck)}`}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-ink-faint">
                {dep.latencyMs > 0 ? `${dep.latencyMs}ms` : ""}
              </span>
              <StatusPill status={dep.status} />
            </div>
          </div>
        ))}
      </Card>

      {/* Chain info */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-ink-muted">
        Supported Chains
      </h2>
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        {[
          { name: "Ethereum Sepolia", chainId: 11155111, rpc: "rpc.sepolia.org", explorer: "sepolia.etherscan.io" },
          { name: "Arbitrum Sepolia", chainId: 421614, rpc: "sepolia-rollup.arbitrum.io", explorer: "sepolia.arbiscan.io" },
          { name: "Base Sepolia", chainId: 84532, rpc: "sepolia.base.org", explorer: "sepolia.basescan.org" },
        ].map((c) => (
          <Card key={c.chainId} className="p-5">
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.name}</div>
              <StatusPill status="ok" />
            </div>
            <div className="mt-3 space-y-1 text-sm text-ink-muted">
              <div>Chain ID: <span className="text-ink-soft">{c.chainId}</span></div>
              <div>RPC: <span className="text-ink-soft">{c.rpc}</span></div>
              <a
                href={`https://${c.explorer}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-[#1F8A4C]/80 hover:text-[#1F8A4C]"
              >
                Explorer ↗
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
