"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/motion/Reveal";

export default function Alerts() {
  const reduce = useReducedMotion();
  return (
    <section className="py-20 md:py-28 bg-carbon-soft/40 border-y border-carbon-line">
      <div className="container-x grid lg:grid-cols-2 gap-12 items-center">
        <Reveal className="order-2 lg:order-1">
          <div className="rounded-card border border-carbon-line bg-carbon/70 p-5 max-w-sm shadow-depth">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-aqua animate-pulseLine" />
              <span className="mono text-[12px] tracking-wider text-ivory/70">LIQUIDAI ENGINE</span>
            </div>
            <div className="space-y-3">
              <AlertRow
                tone="warn"
                title="ETH/USDC position approaching upper range."
                meta="Current price: $4,982 · Upper boundary: $5,018"
              />
              <AlertRow tone="info" title="Rebalance initiated." meta="" />
              <motion.div
                initial={reduce ? false : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <AlertRow tone="ok" title="✓ Rebalance confirmed." meta="Range recentered · gas 9 gwei" />
              </motion.div>
            </div>
          </div>
        </Reveal>

        <Reveal className="order-1 lg:order-2">
          <span className="eyebrow">Smart alerts</span>
          <h2 className="section-title mt-4">Telegram in the loop, not just you.</h2>
          <p className="text-body muted mt-6 max-w-md">
            LiquidAI delivers actionable alerts the moment something matters — drift, rebalances,
            and confirmations — straight to Telegram. Stay informed without staring at a screen.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function AlertRow({ tone, title, meta }: { tone: "warn" | "info" | "ok"; title: string; meta: string }) {
  const color = tone === "ok" ? "border-egreen/40 text-egreen" : tone === "warn" ? "border-accent/40 text-accent" : "border-rblue/40 text-rblue";
  return (
    <div className={`rounded-xl border ${color} bg-carbon-raised/40 px-3.5 py-3`}>
      <p className="text-[14px] font-medium">{title}</p>
      {meta && <p className="mono text-[11px] text-ivory/45 mt-0.5">{meta}</p>}
    </div>
  );
}
