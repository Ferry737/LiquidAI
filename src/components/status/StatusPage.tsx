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
  ok: "bg-[#22892F]/10 text-[#22892F] border-[#22892F]/30",
  degraded: "bg-[#B26A00]/10 text-[#B26A00] border-[#B26A00]/30",
  down: "bg-negative/10 text-negative border-negative/30",
  unknown: "bg-ink/[0.03] text-ink-muted border-ink/10",
};

const DOT_STYLES: Record<DependencyStatusValue, string> = {
  ok: "bg-[#22892F] shadow-card",
  degraded: "bg-amber-400 shadow-card",
  down: "bg-red-400 shadow-card",
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
              ) : data?.engine.running ? (
                <span className="text-[#22892F]">Running</span>
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
              ) : data?.engine.dryRun ? (
                <span className="text-[#B26A00]">Dry run</span>
              ) : (
                <span className="text-[#22892F]">Live</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Per-chain engine health */}
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-ink-muted">
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
              <div className="mt-3 space-y-1 text-sm text-ink-muted">
                <div>
                  Last worker run:{" "}
                  <span className="text-ink-soft">{formatTs(lastRunTs)}</span>
                </div>
                <div>
                  Chain ID: <span className="text-ink-soft">{c.chainId}</span>
                </div>
                {c.lastError && (
                  <div className="truncate text-negative/80" title={c.lastError}>
                    {c.lastError}
                  </div>
                )}
                {info && (
                  <a
                    href={info.blockExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-[#22892F]/80 hover:text-[#22892F]"
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
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-ink-muted">
        Dependencies
      </h2>
      <Card className="divide-y divide-ink/10 p-0" data-testid="dependency-list">
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
              <div className="text-sm font-medium text-ink">
                {dependencyLabel(dep)}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {dep.successCount} ok · {dep.errorCount} errors (10m window)
                {dep.lastError ? ` · ${dep.lastError}` : ""}
              </div>
            </div>
            <StatusPill status={dep.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}
