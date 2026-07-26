// src/components/dashboard/EngineFeed.tsx
// v2.1: Live streaming timeline of strategy_action events from the
// client-side event stream simulator. No backend SSE required.

"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { LocalStrategyAction } from "@/lib/local-storage";

const MAX_ITEMS = 20;

interface FeedItem extends LocalStrategyAction {
  isNew?: boolean;
}

export function EngineFeed({
  actions,
}: {
  actions: LocalStrategyAction[];
}) {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (actions.length === 0) return;
    setItems((prev) => {
      const incoming = actions.slice(-MAX_ITEMS).map((a) => ({ ...a, isNew: true }));
      const merged = [...incoming.reverse(), ...prev].slice(0, MAX_ITEMS);

      setTimeout(() => {
        setItems((cur) => cur.map((i) => ({ ...i, isNew: false })));
      }, 600);

      const seen = new Set<string>();
      return merged.filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
    });
  }, [actions]);

  return (
    <Card hover={false}>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Engine Feed</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22892F]" />
            live
          </span>
        </div>

        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-faint">
            Waiting for engine activity… Enable the engine to see live signals.
          </div>
        ) : (
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
            {items.map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function FeedRow({ item }: { item: FeedItem }) {
  const statusConfig = {
    EXECUTED: { color: "text-[#22892F]", dot: "bg-[#22892F]", glow: "shadow-card" },
    FAILED: { color: "text-negative", dot: "bg-red-400", glow: "shadow-card" },
    DRY_RUN: { color: "text-brand-500", dot: "bg-brand-500", glow: "shadow-card" },
    SKIPPED: { color: "text-ink-faint", dot: "bg-ink-faint", glow: "" },
  } as const;

  const statusKey = (item.status === "EXECUTED"
    ? "EXECUTED"
    : item.status === "FAILED"
      ? "FAILED"
      : item.status === "DRY_RUN"
        ? item.type === "SKIPPED"
          ? "SKIPPED"
          : "DRY_RUN"
        : "SKIPPED") as keyof typeof statusConfig;

  const cfg = statusConfig[statusKey];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2 transition-all duration-300",
        item.isNew && "border-brand-500/20 bg-brand-500/[0.03]"
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot, cfg.glow)} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="min-w-0">
          <span className={cn("text-sm font-medium", cfg.color)}>
            {item.type}
          </span>
          <span className="ml-2 text-xs text-ink-muted truncate">
            {item.details}
          </span>
        </div>
        <span className="shrink-0 text-xs text-ink-faint tabular-nums">
          {new Date(item.ts).toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
