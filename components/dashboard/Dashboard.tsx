"use client";

import { DEMO_POSITIONS } from "@/lib/demo";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useCountUp } from "@/lib/useCountUp";

function RangeBar({ lower, upper, price }: { lower: number; upper: number; price: number }) {
  const lo = Math.min(lower, upper, price) * 0.97;
  const hi = Math.max(lower, upper, price) * 1.03;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const inRange = price >= lower && price <= upper;
  return (
    <div className="relative h-2 rounded-pill bg-carbon-line mt-2 overflow-hidden">
      <div
        className="absolute h-full rounded-pill bg-aqua/40"
        style={{ left: `${pct(lower)}%`, width: `${pct(upper) - pct(lower)}%` }}
      />
      <div
        className="absolute -top-1 h-4 w-[2px] bg-ivory"
        style={{ left: `${pct(price)}%` }}
      />
      <span
        className={`absolute -top-1 h-4 w-1.5 rounded-full ${inRange ? "bg-egreen" : "bg-accent"}`}
        style={{ left: `calc(${pct(price)}% - 3px)` }}
      />
    </div>
  );
}

function SummaryStat({ label, value, prefix = "", suffix = "", decimals = 0 }: any) {
  const { ref, display } = useCountUp(value, decimals);
  return (
    <div className="rounded-card border border-carbon-line bg-carbon-soft/60 p-5">
      <span ref={ref} className="mono text-2xl font-semibold text-ivory tabular-nums">
        {prefix}
        {display}
        {suffix}
      </span>
      <p className="text-[13px] muted mt-1">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  return (
    <section id="product" className="py-20 md:py-28">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">The dashboard</span>
          <h2 className="section-title mt-4 max-w-3xl">
            Institutional software for your on-chain liquidity.
          </h2>
        </Reveal>

        <RevealGroup className="grid lg:grid-cols-[1fr_1.4fr] gap-6 mt-12">
          <RevealItem>
            <div className="grid grid-cols-2 gap-4">
              <SummaryStat label="Total value managed" value={128420} prefix="$" />
              <SummaryStat label="Unclaimed fees" value={4210} prefix="$" />
              <SummaryStat label="Average fee APR" value={31.4} suffix="%" decimals={1} />
              <SummaryStat label="Positions in range" value={3} suffix=" / 3" />
            </div>
          </RevealItem>

          <RevealItem>
            <div className="rounded-card border border-carbon-line bg-carbon-soft/70 p-6 shadow-depth">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-h3 font-semibold">Active positions</h3>
                <span className="mono text-[11px] text-ivory/45">DEMO · TESTNET</span>
              </div>
              <div className="flex flex-col">
                {DEMO_POSITIONS.map((p) => (
                  <div
                    key={p.pair}
                    className="group flex items-center justify-between gap-4 py-4 border-t border-carbon-line first:border-t-0 hover:bg-carbon-raised/40 -mx-2 px-2 rounded-xl transition-colors duration-200"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.pair}</span>
                        <span className="mono text-[11px] px-1.5 py-0.5 rounded-pill bg-carbon-line text-ivory/55">
                          {p.fee}
                        </span>
                      </div>
                      <div className="mono text-[11px] text-ivory/45 mt-0.5">Range {p.range}</div>
                    </div>
                    <div className="w-28 hidden sm:block">
                      <RangeBar lower={p.lower} upper={p.upper} price={p.price} />
                    </div>
                    <span
                      className={`mono text-[11px] px-2.5 py-1 rounded-pill ${
                        p.status === "IN RANGE" ? "bg-egreen/15 text-egreen" : "bg-accent/15 text-accent"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  );
}
