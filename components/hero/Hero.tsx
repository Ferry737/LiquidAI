"use client";

import { motion, useReducedMotion } from "framer-motion";
import LiquidityCurve from "@/components/liquidity-visualizer/LiquidityCurve";
import { Reveal } from "@/components/motion/Reveal";

export default function Hero() {
  const reduce = useReducedMotion();
  return (
    <section id="top" className="relative pt-32 md:pt-40 pb-16 md:pb-24 overflow-hidden">
      {/* ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 500px at 70% -10%, rgba(63,224,197,0.12), transparent 60%), radial-gradient(700px 400px at 10% 10%, rgba(76,141,255,0.08), transparent 55%)",
        }}
      />
      <div className="container-x grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
        <div>
          <Reveal>
            <span className="eyebrow">Autonomous liquidity management</span>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="text-hero font-semibold mt-5">
              Liquidity that
              <br />
              manages itself.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="text-body muted mt-6 max-w-xl">
              LiquidAI automatically creates and rebalances Uniswap v3 concentrated-liquidity
              positions so capital stays productive without constant manual management.
            </p>
          </Reveal>
          <Reveal delay={3}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#launch"
                className="inline-flex items-center gap-2 rounded-pill bg-aqua px-7 py-3.5 text-[15px] font-semibold text-carbon hover:bg-aqua-glow transition-colors duration-200"
              >
                Launch the App →
              </a>
              <a
                href="#backtest"
                className="inline-flex items-center gap-2 rounded-pill border border-carbon-line px-7 py-3.5 text-[15px] font-medium text-ivory hover:border-ivory/40 transition-colors duration-200"
              >
                Run a Backtest
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={2} className="relative">
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <LiquidityCurve />
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
