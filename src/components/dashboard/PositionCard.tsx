// src/components/dashboard/PositionCard.tsx
"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { StrategyDrawer } from "./StrategyDrawer";
import type { PositionView } from "@/lib/positions";
import { FEE_TIERS } from "@/lib/constants";
import { formatUSD, formatPct, formatNum } from "@/lib/utils";

function feeLabel(fee: number) {
  return FEE_TIERS.find((f) => f.fee === fee)?.label ?? `${fee / 10000}%`;
}

export function PositionCard({ p }: { p: PositionView }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rangePct =
    ((p.currentPrice - p.lowerPrice) / (p.upperPrice - p.lowerPrice)) * 100;
  const clamped = Math.max(0, Math.min(100, rangePct));

  return (
    <>
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.pair}</span>
                <span className="rounded-md bg-ink/[0.04] px-1.5 py-0.5 text-xs text-ink-muted">
                  {feeLabel(p.feeTier)}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                #{p.tokenId}
              </div>
            </div>
            <StatusPill inRange={p.inRange} />
          </div>

          <div className="space-y-2">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-ink/[0.04]">
              <div className="absolute inset-y-0 left-[8%] right-[8%] rounded-full bg-gradient-to-r from-brand-500/40 to-brand-400/40" />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-card"
                style={{ left: `calc(${clamped}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-xs tabular-nums text-ink-muted">
              <span>{formatNum(p.lowerPrice, p.lowerPrice < 10 ? 4 : 0)}</span>
              <span>{formatNum(p.upperPrice, p.upperPrice < 10 ? 4 : 0)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Value" value={formatUSD(p.valueUSD)} />
            <Metric
              label="Unclaimed fees"
              value={formatUSD(p.unclaimedFeesUSD)}
              accent="green"
            />
            <Metric label="Fee APR" value={formatPct(p.feeApr)} accent="blue" />
            <Metric
              label="Impermanent loss"
              value={formatPct(p.ilPct)}
              accent={p.ilPct < -1 ? "amber" : "white"}
            />
          </div>

          {!p.inRange && (
            <div className="rounded-lg border border-[#B26A00]/30 bg-[#B26A00]/8 px-3 py-2 text-xs text-[#B26A00]">
              Out of range {formatNum(p.outOfRangeHours, 1)}h · AI will
              rebalance past 6h
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setDrawerOpen(true)}
          >
            ⚙ Strategy & action log
          </Button>
        </CardBody>
      </Card>

      <StrategyDrawer
        positionId={p.dbId}
        pair={p.pair}
        tokenId={p.tokenId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

function Metric({
  label,
  value,
  accent = "white",
}: {
  label: string;
  value: string;
  accent?: "white" | "green" | "blue" | "amber";
}) {
  const color =
    accent === "green"
      ? "text-[#1F8A4C]"
      : accent === "blue"
        ? "text-brand-500"
        : accent === "amber"
          ? "text-[#B26A00]"
          : "text-ink";
  return (
    <div className="rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
