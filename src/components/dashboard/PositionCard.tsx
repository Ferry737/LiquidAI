// src/components/dashboard/PositionCard.tsx
"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import type { PositionView } from "@/lib/positions";
import { FEE_TIERS } from "@/lib/constants";
import { formatUSD, formatPct, formatNum } from "@/lib/utils";

function feeLabel(fee: number) {
  return FEE_TIERS.find((f) => f.fee === fee)?.label ?? `${fee / 10000}%`;
}

export function PositionCard({ p }: { p: PositionView }) {
  const rangePct =
    ((p.currentPrice - p.lowerPrice) / (p.upperPrice - p.lowerPrice)) * 100;
  const clamped = Math.max(0, Math.min(100, rangePct));

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{p.pair}</span>
              <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-xs text-white/50">
                {feeLabel(p.feeTier)}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-white/40">
              #{p.tokenId}
            </div>
          </div>
          <StatusPill inRange={p.inRange} />
        </div>

        <div className="space-y-2">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div className="absolute inset-y-0 left-[8%] right-[8%] rounded-full bg-gradient-to-r from-emerald-400/40 to-cyan-400/40" />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              style={{ left: `calc(${clamped}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-xs tabular-nums text-white/40">
            <span>{formatNum(p.lowerPrice, p.lowerPrice < 10 ? 4 : 0)}</span>
            <span>{formatNum(p.upperPrice, p.upperPrice < 10 ? 4 : 0)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Value" value={formatUSD(p.valueUSD)} />
          <Metric
            label="Unclaimed fees"
            value={formatUSD(p.unclaimedFeesUSD)}
            accent="emerald"
          />
          <Metric label="Fee APR" value={formatPct(p.feeApr)} accent="cyan" />
          <Metric
            label="Impermanent loss"
            value={formatPct(p.ilPct)}
            accent={p.ilPct < -1 ? "amber" : "white"}
          />
        </div>

        {!p.inRange && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
            Out of range {formatNum(p.outOfRangeHours, 1)}h · AI will
            rebalance past 6h
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Metric({
  label,
  value,
  accent = "white",
}: {
  label: string;
  value: string;
  accent?: "white" | "emerald" | "cyan" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "cyan"
        ? "text-cyan-300"
        : accent === "amber"
          ? "text-amber-300"
          : "text-white/90";
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-xs text-white/40">{label}</div>
      <div className={`tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
