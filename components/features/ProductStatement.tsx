"use client";

import { Reveal } from "@/components/motion/Reveal";

export default function ProductStatement() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-x grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <Reveal>
          <span className="eyebrow">Why it matters</span>
          <h2 className="section-title mt-4">
            Concentrated liquidity is powerful.
            <br />
            Managing it manually isn't.
          </h2>
          <p className="text-body muted mt-6 max-w-md">
            Uniswap v3 rewards tight ranges with higher fees — but when price leaves the range,
            capital goes idle. LiquidAI keeps positions centered automatically.
          </p>
        </Reveal>

        <Reveal delay={1} className="relative">
          <div className="rounded-card border border-carbon-line bg-carbon-soft/60 p-7">
            <span className="mono text-[12px] text-ivory/50">ETH / USDC · 0.30%</span>
            <svg viewBox="0 0 360 160" className="w-full mt-5" aria-label="Price drifted outside range">
              <line x1="20" y1="120" x2="340" y2="120" stroke="#222831" />
              {/* active range */}
              <rect x="120" y="30" width="90" height="110" rx="8" fill="rgba(63,224,197,0.12)" />
              <line x1="120" y1="30" x2="120" y2="140" stroke="#3FE0C5" strokeDasharray="3 4" opacity="0.7" />
              <line x1="210" y1="30" x2="210" y2="140" stroke="#4C8DFF" strokeDasharray="3 4" opacity="0.7" />
              {/* price drifted out (right) */}
              <line x1="300" y1="30" x2="300" y2="140" stroke="#FF5C3A" strokeWidth="2" />
              <circle cx="300" cy="30" r="4" fill="#FF5C3A" />
              <text x="300" y="20" textAnchor="middle" className="mono" fontSize="11" fill="#FF5C3A">$5,018</text>
              <text x="165" y="20" textAnchor="middle" className="mono" fontSize="11" fill="#6B7280">ACTIVE RANGE</text>
            </svg>
            <p className="mono text-[11px] text-accent mt-2">Price left the range — fees accrual paused until rebalance.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
