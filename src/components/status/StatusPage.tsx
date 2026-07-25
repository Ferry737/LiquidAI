// src/components/status/StatusPage.tsx
// v1.6: Observability page — per-chain engine health, dependency status
// pills (ok=emerald, degraded=amber, down=red, unknown=grey), last worker
// run per chain. Live-updates via the existing SSE engine_status events,
// which now carry chainId.

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchStatus } from "@/lib/api";
import { useEventStream } from "@/hooks/useEventStream";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { chainById } from "../../../shared/chains";
import type {
  DependencyStatusDto,
  DependencyStatusValue,
  EngineStatusEvent,
} from "../../../shared/types";

const PILL_STYLES: Record<DependencyStatusValue, string> = {
  ok: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30",
  degraded: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  down: "bg-red-400/10 text-red-300 border-red-400/30",
  unknown: "bg-white/[0.04] text-white/40 border-white/10",
};

const DOT_STYLES: Record<DependencyStatusValue, string> = {
  ok: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  degraded: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  down: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]",
  unknown: "bg-white/30",
};

function StatusPill({ status }: { status: DependencyStatusValue }) {
  return (
    <span
      data-testid={`status-pill-${status}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        PILL_STYLES[status]
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[status])} />
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

function dependencyLabel(dep: DependencyStatusDto): string {
  if (dep.name.startsWith("subgraph:")) {
    const slug = dep.name.split(":")[1];
    return `Subgraph · ${slug}`;
  }
  const labels: Record<string, string> = {
    defillama: "DefiLlama",
    telegram: "Telegram",
    llm: "LLM",
    db: "Database",
  };
  return labels[dep.name] ?? dep.name;
}

export function StatusPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["status"],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
  });

  // v1.6: live per-chain engine status via SSE.
  const [liveEngine, setLiveEngine] = useState<
    Record<number, EngineStatusEvent>
  >({});
  useEventStream({
    onEngineStatus: (e) => {
      if (e.chainId !== undefined) {
        setLiveEngine((prev) => ({ ...prev, [e.chainId as number]: e }));
      }
      void refetch();
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          System <span className="text-emerald-400">Status</span>
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Per-chain engine health and dependency status · refreshes live
        </p>
      </div>

      {/* Global engine */}
      <Card className="mb-8 p-6" data-testid="engine-card">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40">
              Engine
            </div>
            <div className="mt-1 text-lg font-medium">
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : data?.engine.running ? (
                <span className="text-emerald-300">Running</span>
              ) : (
                <span className="text-red-300">Stopped</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40">
              Mode
            </div>
            <div className="mt-1 text-lg font-medium">
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : data?.engine.dryRun ? (
                <span className="text-amber-300">Dry run</span>
              ) : (
                <span className="text-emerald-300">Live</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Per-chain engine health */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-white/40">
        Chains
      </h2>
      <div className="mb-10 grid gap-4 md:grid-cols-3" data-testid="chain-grid">
        {isLoading &&
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        {data?.chains.map((c) => {
          const live = liveEngine[c.chainId];
          const lastRunTs = live?.lastRunTs ?? c.lastRunTs;
          const info = chainById(c.chainId);
          const health: DependencyStatusValue =
            c.lastRunOk === null ? "unknown" : c.lastRunOk ? "ok" : "down";
          return (
            <Card
              key={c.chainId}
              className="p-5"
              data-testid={`chain-status-${c.slug}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <StatusPill status={health} />
              </div>
              <div className="mt-3 space-y-1 text-sm text-white/50">
                <div>
                  Last worker run:{" "}
                  <span className="text-white/80">{formatTs(lastRunTs)}</span>
                </div>
                <div>
                  Chain ID: <span className="text-white/80">{c.chainId}</span>
                </div>
                {c.lastError && (
                  <div className="truncate text-red-300/80" title={c.lastError}>
                    {c.lastError}
                  </div>
                )}
                {info && (
                  <a
                    href={info.blockExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-emerald-400/80 hover:text-emerald-300"
                  >
                    Explorer ↗
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dependencies */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-white/40">
        Dependencies
      </h2>
      <Card className="divide-y divide-white/5 p-0" data-testid="dependency-list">
        {isLoading && (
          <div className="p-5">
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {data?.dependencies.map((dep) => (
          <div
            key={dep.name}
            className="flex items-center justify-between px-5 py-4"
            data-testid={`dep-${dep.name}`}
          >
            <div>
              <div className="text-sm font-medium text-white/90">
                {dependencyLabel(dep)}
              </div>
              <div className="mt-0.5 text-xs text-white/40">
                {dep.successCount} ok · {dep.errorCount} errors (10m window)
                {dep.lastError ? ` · ${dep.lastError}` : ""}
              </div>
            </div>
            <StatusPill status={dep.status} />
          </div>
        ))}
      </Card>
    </main>
  );
}
