"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Demo-only visualization of a Uniswap v3 concentrated-liquidity position.
// The price drifts; the AI strategy re-centers the range automatically.

const W = 640;
const H = 320;
const PAD = 36;

function priceToX(price: number, lo: number, hi: number) {
  const t = (price - lo) / (hi - lo);
  return PAD + t * (W - 2 * PAD);
}
function xToPrice(x: number, lo: number, hi: number) {
  const t = (x - PAD) / (W - 2 * PAD);
  return lo + t * (hi - lo);
}

export default function LiquidityCurve({
  price = 4824.2,
  lower = 4430,
  upper = 5170,
}: {
  price?: number;
  lower?: number;
  upper?: number;
}) {
  const reduce = useReducedMotion();
  const driftRef = useRef(0);
  const [state, setState] = useState({ drift: 0, center: (lower + upper) / 2 });

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      driftRef.current += dt * 0.32;
      setState((s) => {
        const drift = Math.sin(driftRef.current) * 60 + Math.sin(driftRef.current * 0.37) * 30;
        const priceNow = price + drift;
        const center = s.center + (priceNow - s.center) * Math.min(1, dt * 0.25);
        return { drift, center };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [price, reduce]);

  const { drift, center } = state;
  const priceNow = price + drift;
  const halfW = (upper - lower) / 2;
  const lo = center - halfW;
  const hi = center + halfW;
  const px = priceToX(priceNow, lo, hi);
  const lx = priceToX(lo, lo, hi);
  const ux = priceToX(hi, lo, hi);

  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = PAD + (i / 60) * (W - 2 * PAD);
    const p = xToPrice(x, lo, hi);
    const dist = Math.abs(p - center) / halfW;
    const y = H - PAD - (H - 2 * PAD) * Math.max(0, 1 - dist * dist) * 0.92;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const inRange = priceNow >= lo && priceNow <= hi;

  return (
    <div className="relative w-full rounded-card border border-carbon-line bg-carbon-soft/70 p-5 shadow-depth overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="mono text-[13px] text-ivory/80">ETH / USDC</span>
          <span className="mono text-[11px] px-2 py-0.5 rounded-pill bg-carbon-line text-ivory/60">0.30%</span>
        </div>
        <span
          className={`mono text-[11px] px-2.5 py-1 rounded-pill ${
            inRange ? "bg-egreen/15 text-egreen" : "bg-accent/15 text-accent"
          }`}
        >
          {inRange ? "IN RANGE" : "OUT OF RANGE"}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Liquidity range visualization">
        <defs>
          <linearGradient id="curve" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3FE0C5" stopOpacity="0.55" />
            <stop offset="1" stopColor="#3FE0C5" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="rangeFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3FE0C5" stopOpacity="0.10" />
            <stop offset="1" stopColor="#4C8DFF" stopOpacity="0.10" />
          </linearGradient>
        </defs>

        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#222831" strokeWidth="1" />

        <rect x={lx} y={PAD} width={Math.max(0, ux - lx)} height={H - 2 * PAD} fill="url(#rangeFill)" />
        <line x1={lx} y1={PAD} x2={lx} y2={H - PAD} stroke="#3FE0C5" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
        <line x1={ux} y1={PAD} x2={ux} y2={H - PAD} stroke="#4C8DFF" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />

        <polyline points={pts.join(" ")} fill="none" stroke="#3FE0C5" strokeWidth="2.5" />
        <polygon points={`${PAD},${H - PAD} ${pts.join(" ")} ${W - PAD},${H - PAD}`} fill="url(#curve)" />

        <line x1={px} y1={PAD} x2={px} y2={H - PAD} stroke="#F7F4EF" strokeWidth="1.5" opacity="0.85" />
        <circle cx={px} cy={PAD + 6} r="4" fill="#F7F4EF" />
        <text x={px} y={PAD - 6} textAnchor="middle" className="mono" fontSize="12" fill="#F7F4EF">
          ${priceNow.toFixed(0)}
        </text>

        <text x={lx} y={H - PAD + 18} textAnchor="middle" className="mono" fontSize="11" fill="#6B7280">
          ${lo.toFixed(0)}
        </text>
        <text x={ux} y={H - PAD + 18} textAnchor="middle" className="mono" fontSize="11" fill="#6B7280">
          ${hi.toFixed(0)}
        </text>
      </svg>

      <div className="mt-3 flex items-center justify-between mono text-[11px] text-ivory/55">
        <span>STRATEGY: Dynamic ±7.5%</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-egreen animate-pulseLine" /> AI re-centering liquidity
        </span>
      </div>
    </div>
  );
}
