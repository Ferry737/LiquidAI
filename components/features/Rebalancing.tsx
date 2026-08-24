"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";

const STAGES = [
  { t: "Price drifting", d: "ETH/USDC price approaches the upper range boundary." },
  { t: "Drift detected", d: "LiquidAI detects the position falling out of optimal range." },
  { t: "Strategy executes", d: "An on-chain rebalance recenters the liquidity range." },
  { t: "Recentered", d: "Position returns to centered range — capital stays productive." },
];

export default function Rebalancing() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.4"] });
  // map progress 0..1 -> stage 0..3
  const stage = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 1, 2, 3]);

  return (
    <section className="py-20 md:py-28 bg-carbon-soft/40 border-y border-carbon-line">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Autonomous rebalancing</span>
          <h2 className="section-title mt-4 max-w-3xl">
            The engine never stops watching.
          </h2>
        </Reveal>

        <div ref={ref} className="mt-14 grid lg:grid-cols-2 gap-10 items-center min-h-[420px]">
          {/* Visualization */}
          <div className="relative rounded-card border border-carbon-line bg-carbon/60 p-6 h-[340px] overflow-hidden">
            <RangeViz progress={scrollYProgress} reduce={!!reduce} />
          </div>

          {/* Stage list */}
          <ol className="flex flex-col gap-3">
            {STAGES.map((s, i) => (
              <motion.li
                key={s.t}
                className="rounded-card border border-carbon-line p-5 transition-colors duration-300"
                style={{
                  background: useTransform(
                    stage,
                    (v) => (Math.round(v) === i ? "rgba(63,224,197,0.08)" : "transparent")
                  ),
                  borderColor: useTransform(
                    stage,
                    (v) => (Math.round(v) === i ? "rgba(63,224,197,0.5)" : "rgba(34,40,49,1)")
                  ),
                }}
              >
                <div className="flex items-baseline gap-3">
                  <span className="mono text-[12px] text-aqua">0{i + 1}</span>
                  <span className="font-semibold">{s.t}</span>
                </div>
                <p className="muted text-[15px] mt-1.5">{s.d}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function RangeViz({ progress, reduce }: { progress: any; reduce: boolean }) {
  // position of price within range moves from in-range to near edge then recenters
  const priceX = useTransform(progress, [0, 0.33, 0.5, 0.66, 1], [50, 82, 88, 50, 50]);
  const rangeShift = useTransform(progress, [0, 0.5, 0.66, 1], [0, 0, 18, 0]);
  return (
    <svg viewBox="0 0 400 260" className="w-full h-full" aria-label="Rebalancing sequence">
      <defs>
        <linearGradient id="rb-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3FE0C5" stopOpacity="0.18" />
          <stop offset="1" stopColor="#4C8DFF" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1="30" y1="150" x2="370" y2="150" stroke="#222831" />
      {/* active range band */}
      <motion.rect
        x={90 + rangeShift.get()}
        y={40}
        width={220}
        height={220}
        rx={10}
        fill="url(#rb-band)"
        style={{ x: useTransform(rangeShift, (v) => 90 + v) }}
      />
      <motion.line x1={90} y1={40} x2={90} y2={260} stroke="#3FE0C5" strokeDasharray="3 4" style={{ x: useTransform(rangeShift, (v) => 90 + v) }} />
      <motion.line x1={310} y1={40} x2={310} y2={260} stroke="#4C8DFF" strokeDasharray="3 4" style={{ x: useTransform(rangeShift, (v) => 90 + v + 220) }} />
      {/* price */}
      <motion.line x1={200} y1={40} x2={200} y2={260} stroke="#F7F4EF" strokeWidth="2" style={{ x: useTransform(priceX, (v) => v) }} />
      <motion.circle cx={200} cy={40} r="5" fill="#F7F4EF" style={{ cx: useTransform(priceX, (v) => v) }} />
    </svg>
  );
}
