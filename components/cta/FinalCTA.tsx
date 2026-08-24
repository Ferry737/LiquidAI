"use client";

import { Reveal } from "@/components/motion/Reveal";
import LiquidityCurve from "@/components/liquidity-visualizer/LiquidityCurve";

export default function FinalCTA() {
  return (
    <section id="launch" className="relative py-24 md:py-36 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(800px 500px at 50% 0%, rgba(63,224,197,0.12), transparent 60%)",
        }}
      />
      <div className="container-x max-w-3xl text-center">
        <Reveal>
          <h2 className="section-title">Put your liquidity to work.</h2>
        </Reveal>
        <Reveal delay={1}>
          <p className="text-body muted mt-6 max-w-xl mx-auto">
            Connect a wallet, deploy a position, and let LiquidAI handle the ongoing range
            management.
          </p>
        </Reveal>
        <Reveal delay={2}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#top"
              className="inline-flex items-center gap-2 rounded-pill bg-aqua px-8 py-4 text-[15px] font-semibold text-carbon hover:bg-aqua-glow transition-colors duration-200"
            >
              Launch App →
            </a>
            <a
              href="#backtest"
              className="inline-flex items-center gap-2 rounded-pill border border-carbon-line px-8 py-4 text-[15px] font-medium text-ivory hover:border-ivory/40 transition-colors duration-200"
            >
              Run a Backtest
            </a>
          </div>
        </Reveal>
      </div>
      <div className="container-x max-w-2xl mt-16">
        <Reveal delay={2}>
          <LiquidityCurve price={4970} lower={4480} upper={5320} />
        </Reveal>
      </div>
    </section>
  );
}
