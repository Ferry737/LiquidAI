"use client";

import { Reveal, RevealGroup } from "@/components/motion/Reveal";

const POINTS = [
  "Strategies automate. Custody doesn't change.",
  "LiquidAI never takes possession of your funds — positions live in your wallet.",
  "Execution is verifiable on-chain; you can audit every action.",
  "Connect with a wallet. No deposits to a third party. No custody transfer.",
];

export default function Security() {
  return (
    <section className="py-20 md:py-28 bg-carbon-soft/40 border-y border-carbon-line">
      <div className="container-x max-w-4xl text-center">
        <Reveal>
          <span className="eyebrow">Security & custody</span>
          <h2 className="section-title mt-4">Your strategy automates. Your custody doesn't change.</h2>
        </Reveal>
        <RevealGroup className="grid sm:grid-cols-2 gap-4 mt-12 text-left">
          {POINTS.map((p) => (
            <Reveal
              key={p}
              className="rounded-card border border-carbon-line bg-carbon/60 p-6"
            >
              <p className="text-[16px] text-ivory/90">{p}</p>
            </Reveal>
          ))}
        </RevealGroup>
        <p className="mono text-[11px] text-ivory/35 mt-8">
          No security audits, institutional partners, or TVL figures are claimed unless independently verified.
        </p>
      </div>
    </section>
  );
}
