"use client";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

const TX = [
  { hash: "0x9f3a…c41b", block: "19,482,201", action: "REBALANCE", pair: "ETH/USDC", range: "$4,430 — $5,170", time: "12s ago" },
  { hash: "0x71be…2f9a", block: "19,482,188", action: "COMPOUND", pair: "WBTC/ETH", range: "$2,910 — $3,340", time: "4m ago" },
  { hash: "0x44c0…88de", block: "19,482,140", action: "ALERT", pair: "DAI/USDC", range: "$0.998 — $1.002", time: "11m ago" },
];

export default function OnChain() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-x grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <span className="eyebrow">On-chain transparency</span>
          <h2 className="section-title mt-4">Automation without black boxes.</h2>
          <p className="text-body muted mt-6 max-w-md">
            Every action LiquidAI takes is executed on-chain and verifiable. Your wallet. Your
            liquidity. Verifiable execution — not a promise in a dashboard.
          </p>
        </Reveal>

        <RevealGroup className="flex flex-col gap-3">
          {TX.map((t) => (
            <RevealItem key={t.hash}>
              <div className="rounded-card border border-carbon-line bg-carbon-soft/60 p-4 grid grid-cols-[auto_1fr_auto] gap-4 items-center hover:border-aqua/40 transition-colors duration-200">
                <span className="mono text-[11px] px-2 py-1 rounded-pill bg-aqua/15 text-aqua">{t.action}</span>
                <div className="min-w-0">
                  <div className="mono text-[12px] text-ivory/80 truncate">{t.hash}</div>
                  <div className="mono text-[11px] text-ivory/45">
                    {t.pair} · {t.range}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-[12px] text-ivory/70">#{t.block}</div>
                  <div className="mono text-[11px] text-ivory/40">{t.time}</div>
                </div>
              </div>
            </RevealItem>
          ))}
          <p className="mono text-[11px] text-ivory/35 mt-1">Illustrative transactions · demo environment</p>
        </RevealGroup>
      </div>
    </section>
  );
}
