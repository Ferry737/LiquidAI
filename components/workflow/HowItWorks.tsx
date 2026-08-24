"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";

const STEPS = [
  {
    n: "01",
    title: "Connect",
    desc: "Connect your wallet. No email. No password. Your keys, your custody.",
    panel: "connect",
  },
  {
    n: "02",
    title: "Create",
    desc: "Choose pool, fee tier, range, strategy, and capital allocation in one pass.",
    panel: "create",
  },
  {
    n: "03",
    title: "Automate",
    desc: "LiquidAI monitors, alerts, rebalances, tracks, and compounds the position.",
    panel: "automate",
  },
];

export default function HowItWorks() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            setActive(idx);
          }
        });
      },
      { threshold: 0.6 }
    );
    refs.current.forEach((r) => r && obs.observe(r));
    return () => obs.disconnect();
  }, []);

  return (
    <section id="how" className="py-20 md:py-28 bg-carbon-soft/40 border-y border-carbon-line">
      <div className="container-x grid lg:grid-cols-2 gap-12">
        <Reveal>
          <span className="eyebrow">How it works</span>
          <h2 className="section-title mt-4">From wallet to working capital.</h2>
        </Reveal>

        <div />
        {STEPS.map((s, i) => (
          <div key={s.n} className="contents" />
        ))}

        <div className="flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              data-idx={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="py-10"
            >
              <div
                className={`flex items-start gap-5 transition-opacity duration-300 ${
                  active === i ? "opacity-100" : "opacity-40"
                }`}
              >
                <span className={`mono text-2xl font-semibold ${active === i ? "text-aqua" : "text-graphite"}`}>
                  {s.n}
                </span>
                <div>
                  <h3 className="text-h3 font-semibold">{s.title}</h3>
                  <p className="muted text-[16px] mt-2 max-w-sm">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* sticky panel */}
        <div className="lg:sticky lg:top-28 lg:h-fit hidden lg:block">
          <motion.div
            className="rounded-card border border-carbon-line bg-carbon/70 p-7 shadow-depth min-h-[320px]"
            animate={{ y: active === 0 ? 0 : active === 1 ? -4 : -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {active === 0 && <ConnectPanel />}
            {active === 1 && <CreatePanel />}
            {active === 2 && <AutomatePanel />}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ConnectPanel() {
  return (
    <div>
      <span className="mono text-[12px] text-ivory/50">STEP 01</span>
      <h4 className="text-xl font-semibold mt-3">Connect a wallet</h4>
      <div className="mt-5 space-y-2.5">
        {["MetaMask", "Rabby", "WalletConnect"].map((w) => (
          <div key={w} className="rounded-xl border border-carbon-line px-4 py-3 flex items-center justify-between hover:border-aqua/40 transition-colors">
            <span>{w}</span>
            <span className="mono text-[11px] text-aqua">Connect →</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreatePanel() {
  const rows = [
    ["Pool", "ETH / USDC"],
    ["Fee tier", "0.30%"],
    ["Range", "±7.5%"],
    ["Strategy", "Balanced"],
    ["Capital", "$10,000"],
  ];
  return (
    <div>
      <span className="mono text-[12px] text-ivory/50">STEP 02</span>
      <h4 className="text-xl font-semibold mt-3">Configure position</h4>
      <div className="mt-5 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-xl border border-carbon-line px-4 py-3">
            <span className="text-[14px] muted">{k}</span>
            <span className="mono text-[13px] text-ivory/85">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutomatePanel() {
  const items = [
    ["Monitoring", "live", "egreen"],
    ["Rebalance trigger", "80%", "aqua"],
    ["Alerts", "Telegram", "rblue"],
    ["Compounding", "ON", "egreen"],
  ] as const;
  return (
    <div>
      <span className="mono text-[12px] text-ivory/50">STEP 03</span>
      <h4 className="text-xl font-semibold mt-3">Engine running</h4>
      <div className="mt-5 space-y-2.5">
        {items.map(([k, v, c]) => (
          <div key={k} className="flex items-center justify-between rounded-xl border border-carbon-line px-4 py-3">
            <span className="text-[14px] muted">{k}</span>
            <span className={`mono text-[12px] text-${c}`}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
