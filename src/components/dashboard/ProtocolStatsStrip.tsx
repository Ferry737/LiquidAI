// src/components/dashboard/ProtocolStatsStrip.tsx
"use client";

import { useProtocolStats } from "@/hooks/useProtocolStats";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatUSD } from "@/lib/utils";

interface ItemProps {
  label: string;
  value: number;
  accent: string;
}

function StripItem({ label, value, accent }: ItemProps) {
  return (
    <div className="flex items-baseline gap-2.5 px-5 py-3 first:pl-6 last:pr-6">
      <span className="text-[11px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <span className={`text-sm font-semibold ${accent}`}>
        <AnimatedNumber value={value} format={(n) => formatUSD(n)} />
      </span>
    </div>
  );
}

export function ProtocolStatsStrip() {
  const { data, isLoading } = useProtocolStats();

  if (isLoading) {
    return <Skeleton className="h-11 w-full rounded-2xl" />;
  }
  if (!data) return null;

  return (
    <div className="flex flex-wrap items-center divide-x divide-ink/10 rounded-2xl border border-ink/10 bg-ink/[0.03] backdrop-blur-xl animate-fade-up">
      <StripItem
        label="Uniswap v3 TVL"
        value={data.protocolTvlUSD}
        accent="text-ink"
      />
      <StripItem
        label="Ethereum TVL"
        value={data.chainTvlUSD}
        accent="text-brand-500"
      />
      <StripItem
        label="24h volume"
        value={data.volume24hUSD}
        accent="text-[#1F8A4C]"
      />
      <div className="ml-auto hidden items-center gap-1.5 pr-6 text-[11px] text-ink-faint md:flex">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1F8A4C]/80" />
        live · DefiLlama
      </div>
    </div>
  );
}
