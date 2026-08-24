"use client";

import { CHAINS } from "@/lib/demo";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";

export default function MultiChain() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-x">
        <Reveal>
          <span className="eyebrow">Multi-chain architecture</span>
          <h2 className="section-title mt-4 max-w-2xl">
            One strategy engine. Every chain you operate on.
          </h2>
        </Reveal>

        <RevealGroup className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {CHAINS.map((c) => (
            <RevealItem key={c.name}>
              <div className="rounded-card border border-carbon-line bg-carbon-soft/60 p-6 h-full hover:border-aqua/40 transition-colors duration-200">
                <div className="flex items-center justify-between">
                  <span className="h-2.5 w-2.5 rounded-full bg-aqua" />
                  <span
                    className={`mono text-[10px] px-2 py-0.5 rounded-pill ${
                      c.state === "live" ? "bg-egreen/15 text-egreen" : "bg-graphite/20 text-graphite"
                    }`}
                  >
                    {c.state.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mt-4">{c.name}</h3>
                <p className="text-[13px] muted mt-1">
                  {c.state === "live" ? "Position management active" : "Planned · not yet deployed"}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
        <p className="mono text-[11px] text-ivory/35 mt-4">
          Chain support status is shown accurately. Testnet/planned networks are not presented as live.
        </p>
      </div>
    </section>
  );
}
