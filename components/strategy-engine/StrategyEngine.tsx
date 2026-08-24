"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";

type Strat = "Conservative" | "Balanced" | "Aggressive";

export default function StrategyEngine() {
  const [strat, setStrat] = useState<Strat>("Balanced");
  const [range, setRange] = useState(7.5);
  const [trigger, setTrigger] = useState(80);
  const [gas, setGas] = useState(12);
  const [compound, setCompound] = useState(true);
  const [tg, setTg] = useState(true);
  const [risk, setRisk] = useState("Moderate");

  return (
    <section id="strategies" className="py-20 md:py-28">
      <div className="container-x grid lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <span className="eyebrow">Strategy engine</span>
          <h2 className="section-title mt-4">
            Rules you define.
            <br />
            Execution you don't have to babysit.
          </h2>
          <p className="text-body muted mt-6 max-w-md">
            Configure the intelligence layer once. LiquidAI executes it continuously, on-chain,
            with full transparency.
          </p>
        </Reveal>

        <Reveal delay={1}>
          <div className="rounded-card border border-carbon-line bg-carbon-soft/70 p-7 shadow-depth">
            {/* Strategy segmented */}
            <Field label="Strategy">
              <div className="flex gap-1.5 rounded-pill bg-carbon-line/60 p-1">
                {(["Conservative", "Balanced", "Aggressive"] as Strat[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrat(s)}
                    className={`flex-1 rounded-pill px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                      strat === s ? "bg-aqua text-carbon" : "text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>

            <Slider label="Range Width" value={range} suffix="%" min={2} max={20} step={0.5} onChange={setRange} />
            <Slider label="Rebalance Trigger" value={trigger} suffix="%" min={50} max={95} step={1} onChange={setTrigger} />

            <Field label="Gas Threshold">
              <div className="flex items-center gap-2 rounded-xl border border-carbon-line px-3 py-2">
                <span className="text-[13px] muted">{"<"}</span>
                <input
                  type="number"
                  value={gas}
                  onChange={(e) => setGas(Number(e.target.value))}
                  className="bg-transparent w-16 mono text-[14px] text-ivory outline-none"
                />
                <span className="mono text-[13px] text-ivory/60">gwei</span>
              </div>
            </Field>

            <Field label="Auto Compound">
              <Toggle on={compound} onClick={() => setCompound((v) => !v)} />
            </Field>
            <Field label="Alert Channel · Telegram">
              <Toggle on={tg} onClick={() => setTg((v) => !v)} />
            </Field>

            <Field label="Risk Mode">
              <div className="flex gap-1.5 rounded-pill bg-carbon-line/60 p-1">
                {["Low", "Moderate", "High"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRisk(r)}
                    className={`flex-1 rounded-pill px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                      risk === r ? "bg-rblue text-white" : "text-ivory/60 hover:text-ivory"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Field>

            <p className="mono text-[11px] text-ivory/35 mt-3">Demo builder · configure your own strategy</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-carbon-line first:border-t-0 gap-4">
      <span className="text-[14px] muted">{label}</span>
      <div className="w-44">{children}</div>
    </div>
  );
}

function Slider({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-aqua"
        />
        <span className="mono text-[13px] text-ivory/85 w-12 text-right">
          ±{value}
          {suffix}
        </span>
      </div>
    </Field>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={`relative h-7 w-12 rounded-pill transition-colors duration-200 ${on ? "bg-aqua" : "bg-carbon-line"}`}
    >
      <motion.span
        layout
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
        style={{ left: on ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
    </button>
  );
}
