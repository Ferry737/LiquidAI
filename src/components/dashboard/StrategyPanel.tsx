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
                ? "bg-emerald-400/10 text-emerald-300"
                : "bg-red-400/10 text-red-300")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (live ? "bg-emerald-400 animate-pulse" : "bg-red-400")
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
            className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-xs font-medium text-white/70">
                {r.key === "rebalance"
                  ? "Rebalance"
                  : r.key === "compound"
                    ? "Auto-compound"
                    : "Slippage guard"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-white/40">{r.label}</p>
            {r.key === "rebalance" && (
              <p className="mt-2 text-xs tabular-nums text-amber-300">
                {rebalanceQueue.length} queued
              </p>
            )}
            {r.key === "compound" && (
              <p className="mt-2 text-xs tabular-nums text-emerald-300">
                {compoundQueue.length} eligible ·{" "}
                {formatUSD(
                  compoundQueue.reduce((s, p) => s + p.unclaimedFeesUSD, 0)
                )}
              </p>
            )}
            {r.key === "slippage" && (
              <p className="mt-2 text-xs tabular-nums text-white/60">
                0.50% max
              </p>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
