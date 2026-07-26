// src/components/dashboard/EngineFeed.tsx
// v1.3: Live streaming timeline of strategy_action events from SSE.
// Status colors: executed=emerald, failed=red, skipped=zinc, dry_run=cyan.

"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import type { StrategyActionDto } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_ITEMS = 20;

interface FeedItem extends StrategyActionDto {
  isNew?: boolean;
}

export function EngineFeed({
  actions,
}: {
  actions: StrategyActionDto[];
}) {
  // Keep a rolling buffer of the latest 20 items
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (actions.length === 0) return;
    setItems((prev) => {
      const incoming = actions.slice(-MAX_ITEMS).map((a) => ({ ...a, isNew: true }));
      const merged = [...incoming.reverse(), ...prev].slice(0, MAX_ITEMS);

      // Clear "isNew" after animation
      setTimeout(() => {
        setItems((cur) => cur.map((i) => ({ ...i, isNew: false })));
      }, 600);

      // Deduplicate by id
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
            Waiting for engine activity…
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

  // The status might be SKIPPED for the action type
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

  const details = parseDetails(item.detailsJson);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2 transition-all duration-300",
        item.isNew && "border-ink/10 bg-ink/[0.03]"
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot, cfg.glow)} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="min-w-0">
          <span className={cn("text-sm font-medium", cfg.color)}>
            {item.type}
          </span>
          {details.gasCostUsd !== undefined && (
            <span className="ml-2 text-xs text-ink-faint">
              gas ~${details.gasCostUsd.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-ink-faint">
          {details.expectedAmount0 && (
            <span className="tabular-nums">
              {shorten(details.expectedAmount0)} / {shorten(details.expectedAmount1 ?? "")}
            </span>
          )}
          <span className="tabular-nums">
            {new Date(item.ts).toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

function parseDetails(json: string): Record<string, any> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function shorten(s: string): string {
  if (!s || s === "0") return "0";
  const n = BigInt(s);
  if (n < 10_000n) return n.toString();
  // Show in human-readable form
  return (Number(n) / 1e6).toFixed(2) + "M";
}
