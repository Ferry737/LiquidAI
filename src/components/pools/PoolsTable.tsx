// src/components/pools/PoolsTable.tsx
// v2.1: Uses the subgraph RankedPool type (client-side). No backend dependency.
"use client";

import Link from "next/link";
import { usePools } from "@/hooks/usePools";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { Skeleton } from "@/components/ui/Skeleton";
import { FEE_TIERS } from "@/lib/constants";
import { formatUSD, formatPct } from "@/lib/utils";

function feeLabel(fee: number) {
  return FEE_TIERS.find((f) => f.fee === fee)?.label ?? `${fee / 10000}%`;
}

export function PoolsTable() {
  const { data, isLoading } = usePools();

  return (
    <Card hover={false} className="overflow-hidden">
      <div className="grid grid-cols-12 gap-4 border-b border-ink/10 px-6 py-4 text-xs uppercase tracking-wider text-ink-muted">
        <div className="col-span-4">Pool</div>
        <div className="col-span-2 text-right">TVL</div>
        <div className="col-span-2 text-right">Volume 24h</div>
        <div className="col-span-2 text-right">Fee APR</div>
        <div className="col-span-2 text-right">14d</div>
      </div>

      {isLoading &&
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-4 px-6 py-4">
            <Skeleton className="col-span-4 h-6" />
            <Skeleton className="col-span-2 h-6" />
            <Skeleton className="col-span-2 h-6" />
            <Skeleton className="col-span-2 h-6" />
            <Skeleton className="col-span-2 h-6" />
          </div>
        ))}

      {!isLoading &&
        data?.map((p, i) => (
          <Link
            key={p.id}
            href={`/create?pool=${encodeURIComponent(p.pair)}&fee=${p.feeTier}`}
            className="grid grid-cols-12 items-center gap-4 px-6 py-4 text-sm transition-colors duration-200 hover:bg-ink/[0.03] animate-fade-up"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="col-span-4 flex items-center gap-3">
              <span className="text-ink-faint tabular-nums">{i + 1}</span>
              <span className="font-medium">{p.pair}</span>
              <span className="rounded-md bg-ink/[0.04] px-1.5 py-0.5 text-xs text-ink-muted">
                {feeLabel(p.feeTier)}
              </span>
            </div>
            <div className="col-span-2 text-right tabular-nums text-ink-soft">
              {formatUSD(p.tvlUSD)}
            </div>
            <div className="col-span-2 text-right tabular-nums text-ink-soft">
              {formatUSD(p.volume24hUSD)}
            </div>
            <div className="col-span-2 text-right tabular-nums text-[#22892F]">
              {formatPct(p.feeApr)}
            </div>
            <div className="col-span-2 flex justify-end">
              <Sparkline data={p.sparkline} />
            </div>
          </Link>
        ))}
    </Card>
  );
}
