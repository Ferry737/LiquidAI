"use client";

import { DEMO_METRICS } from "@/lib/demo";
import { useCountUp } from "@/lib/useCountUp";

function Metric({ label, value, prefix = "", suffix = "", decimals = 0 }: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const { ref, display } = useCountUp(value, decimals);
  return (
    <div className="flex flex-col gap-1">
      <span ref={ref} className="mono text-2xl md:text-[28px] font-semibold text-ivory tabular-nums">
        {prefix}
        {display}
        {suffix}
      </span>
      <span className="mono text-[11px] tracking-wider uppercase text-ivory/45">{label}</span>
    </div>
  );
}

export default function MetricsStrip() {
  return (
    <section className="border-y border-carbon-line bg-carbon-soft/50">
      <div className="container-x py-7">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-4">
          <Metric label="Total Value Managed" value={DEMO_METRICS.totalValueManaged} prefix="$" />
          <Metric label="Unclaimed Fees" value={DEMO_METRICS.unclaimedFees} prefix="$" />
          <Metric label="Avg Fee APR" value={DEMO_METRICS.avgFeeApr} suffix="%" decimals={1} />
          <Metric
            label="Positions In Range"
            value={DEMO_METRICS.positionsInRange}
            suffix={` / ${DEMO_METRICS.positionsTotal}`}
          />
          <div className="flex flex-col gap-1">
            <span className="mono text-2xl md:text-[28px] font-semibold text-egreen flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-egreen animate-pulseLine" /> LIVE
            </span>
            <span className="mono text-[11px] tracking-wider uppercase text-ivory/45">Engine</span>
          </div>
        </div>
        <p className="sr-only">Demo metrics for visualization only — not real TVL or performance.</p>
      </div>
    </section>
  );
}
