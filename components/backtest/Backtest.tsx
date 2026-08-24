"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";
import { BACKTEST } from "@/lib/demo";

// deterministic mock series per timeframe
function seriesFor(tf: string) {
  const n = 40;
  const seed = tf.length * 7;
  const strat: number[] = [];
  const bench: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const wave = Math.sin((t * Math.PI * 2 + seed) ) * 6;
    strat.push(18 + t * 14 + wave + Math.sin(t * 9) * 2);
    bench.push(12 + t * 6 + Math.sin(t * 5 + 1) * 3);
  }
  return { strat, bench, n };
}

const FRAMES = ["1M", "3M", "6M", "1Y"];

export default function Backtest() {
  const [tf, setTf] = useState("1Y");
  const { strat, bench, n } = seriesFor(tf);
  const W = 560, H = 240, PAD = 30;

  const max = Math.max(...strat, ...bench) * 1.1;
  const min = Math.min(...strat, ...bench) * 0.85;
  const xy = (arr: number[]) =>
    arr.map((v, i) => {
      const x = PAD + (i / (n - 1)) * (W - 2 * PAD);
      const y = H - PAD - ((v - min) / (max - min)) * (H - 2 * PAD);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

  const stratPts = xy(strat);
  const benchPts = xy(bench);

  const stats = [
    { label: "Strategy APR", value: `${BACKTEST.strategyApr}%`, tone: "text-aqua" },
    { label: "Benchmark APR", value: `${BACKTEST.benchmarkApr}%`, tone: "text-rblue" },
    { label: "Max Drawdown", value: `${BACKTEST.maxDrawdown}%`, tone: "text-accent" },
    { label: "Rebalances", value: `${BACKTEST.rebalances}`, tone: "text-ivory" },
    { label: "Fees Earned", value: `$${BACKTEST.feesEarned.toLocaleString()}`, tone: "text-egreen" },
  ];

  return (
    <section id="backtest" className="py-20 md:py-28 bg-carbon-soft/40 border-y border-carbon-line">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Backtesting</span>
          <h2 className="section-title mt-4">Test the strategy before risking capital.</h2>
        </Reveal>

        <div className="mt-12 grid lg:grid-cols-[1.5fr_1fr] gap-6">
          <Reveal>
            <div className="rounded-card border border-carbon-line bg-carbon-soft/70 p-6 shadow-depth">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1.5 rounded-pill bg-carbon-line/60 p-1">
                  {FRAMES.map((f) => (
                    <button
                      key={f}
                      onClick={() => setTf(f)}
                      className={`rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors duration-200 ${
                        tf === f ? "bg-aqua text-carbon" : "text-ivory/60 hover:text-ivory"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 mono text-[12px]">
                  <span className="flex items-center gap-1.5 text-aqua">
                    <span className="h-2 w-2 rounded-full bg-aqua" /> Strategy
                  </span>
                  <span className="flex items-center gap-1.5 text-rblue">
                    <span className="h-2 w-2 rounded-full bg-rblue" /> Benchmark
                  </span>
                </div>
              </div>

              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-label="Backtest performance chart">
                <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#222831" />
                <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#222831" />
                <motion.polyline
                  key={`b-${tf}`}
                  points={benchPts.join(" ")}
                  fill="none"
                  stroke="#4C8DFF"
                  strokeWidth="2"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.polyline
                  key={`s-${tf}`}
                  points={stratPts.join(" ")}
                  fill="none"
                  stroke="#3FE0C5"
                  strokeWidth="2.5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <p className="mono text-[11px] text-ivory/35 mt-2">Simulated historical performance · demo/testnet data</p>
            </div>
          </Reveal>

          <Reveal delay={1}>
            <div className="grid grid-cols-1 gap-3 h-full">
              {stats.map((s) => (
                <div key={s.label} className="rounded-card border border-carbon-line bg-carbon/60 p-5">
                  <span className={`mono text-2xl font-semibold ${s.tone}`}>{s.value}</span>
                  <p className="text-[13px] muted mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
