// src/components/dashboard/StrategyPanel.tsx
"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { PositionView } from "@/lib/positions";
import { formatUSD } from "@/lib/utils";

const RULES = [
  { key: "rebalance", label: "Rebalance range when out-of-range > 6h" },
  { key: "compound", label: "Auto-compound fees when > $10 equivalent" },
  { key: "slippage", label: "Max slippage 0.5% on every action" },
] as const;

export function StrategyPanel({ positions }: { positions: PositionView[] }) {
  const [live, setLive] = useState(true);

  const rebalanceQueue = positions.filter(
    (p) => !p.inRange && p.outOfRangeHours > 6
  );
  const compoundQueue = positions.filter((p) => p.unclaimedFeesUSD > 10);

  return (
    <Card hover={false}>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>AI Strategy Engine</CardTitle>
        <div className="flex items-center gap-3">
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs " +
              (live
                ? "bg-[#22892F]/10 text-[#22892F]"
                : "bg-negative/10 text-negative")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (live ? "bg-[#22892F] animate-pulse" : "bg-red-400")
              }
            />
            {live ? "Active" : "Kill switch on"}
          </span>
          <Button
            variant={live ? "danger" : "primary"}
            onClick={() => setLive((v) => !v)}
          >
            {live ? "Kill switch" : "Resume"}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="grid gap-4 md:grid-cols-3">
        {RULES.map((r) => (
          <div
            key={r.key}
            className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              <span className="text-xs font-medium text-ink/70">
                {r.key === "rebalance"
                  ? "Rebalance"
                  : r.key === "compound"
                    ? "Auto-compound"
                    : "Slippage guard"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">{r.label}</p>
            {r.key === "rebalance" && (
              <p className="mt-2 text-xs tabular-nums text-[#B26A00]">
                {rebalanceQueue.length} queued
              </p>
            )}
            {r.key === "compound" && (
              <p className="mt-2 text-xs tabular-nums text-[#22892F]">
                {compoundQueue.length} eligible ·{" "}
                {formatUSD(
                  compoundQueue.reduce((s, p) => s + p.unclaimedFeesUSD, 0)
                )}
              </p>
            )}
            {r.key === "slippage" && (
              <p className="mt-2 text-xs tabular-nums text-ink-muted">
                0.50% max
              </p>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
