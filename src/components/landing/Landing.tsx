// src/components/landing/Landing.tsx
"use client";

import Link from "next/link";
import { useProtocolStats } from "@/hooks/useProtocolStats";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatUSD } from "@/lib/utils";

const FEATURES = [
  {
    icon: "⚡",
    title: "Autonomous rebalancing",
    body: "A rule-based engine watches every position and re-centers liquidity before fees bleed out — no manual babysitting.",
  },
  {
    icon: "📊",
    title: "Concentrated liquidity, done right",
    body: "Deploy Uniswap v3 ranges with tighter capital efficiency and let LiquidAI keep them in the money.",
  },
  {
    icon: "🛡️",
    title: "On-chain & verifiable",
    body: "Positions live on-chain, actions are signed and auditable. Your keys, your liquidity, fully transparent.",
  },
  {
    icon: "🔔",
    title: "Smart alerts",
    body: "Get Telegram pings when a position drifts out of range or the engine takes action on your behalf.",
  },
  {
    icon: "🧪",
    title: "Backtest before you bet",
    body: "Compare strategy presets against historical pools to see APR and drawdown before committing capital.",
  },
  {
    icon: "🌐",
    title: "Multi-chain ready",
    body: "Built for testnets today with a chain registry that scales to mainnet networks as you opt in.",
  },
];

const STEPS = [
  { n: "01", title: "Connect", body: "Link a wallet and sign in with a message — no email, no password." },
  { n: "02", title: "Create", body: "Pick a pool, set a range, and deploy a concentrated liquidity position." },
  { n: "03", title: "Automate", body: "The engine monitors and rebalances. You watch yield compound." },
];

export function Landing() {
  const { data: stats, isLoading } = useProtocolStats();

  return (
    <div className="space-y-28 pb-24">
      {/* ===== Hero ===== */}
      <section className="relative pt-10 sm:pt-16">
        <Reveal className="mx-auto max-w-4xl text-center" duration={0.7}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs text-white/60 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Autonomous Uniswap v3 liquidity management
          </div>
          <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Liquidity that{" "}
            <span className="text-gradient">manages itself</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-white/55">
            LiquidAI auto-creates and rebalances Uniswap v3 concentrated
            liquidity positions with a rule-based AI strategy engine — so you
            capture more fees with far less drift.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3 text-sm font-semibold text-base-900 shadow-[0_10px_40px_rgba(52,211,153,0.4)] transition-all duration-200 hover:brightness-110"
            >
              Launch the app →
            </Link>
            <Link
              href="/backtest"
              className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-3 text-sm font-medium text-white/80 backdrop-blur transition-all duration-200 hover:bg-white/[0.06] hover:text-white"
            >
              Run a backtest
            </Link>
          </div>
        </Reveal>

        <Reveal className="mx-auto mt-16 max-w-5xl" delay={0.15} duration={0.8}>
          <HeroMockup />
        </Reveal>
      </section>

      {/* ===== Live protocol stats ===== */}
      <section className="mx-auto max-w-5xl">
        <Reveal>
          <div className="glass grid grid-cols-2 gap-px overflow-hidden rounded-3xl border-white/10 sm:grid-cols-4">
            <Stat
              label="Uniswap v3 TVL"
              value={
                isLoading || !stats ? null : formatUSD(stats.protocolTvlUSD)
              }
            />
            <Stat
              label="24h volume"
              value={
                isLoading || !stats ? null : formatUSD(stats.volume24hUSD)
              }
              accent
            />
            <Stat
              label="Ethereum TVL"
              value={isLoading || !stats ? null : formatUSD(stats.chainTvlUSD)}
            />
            <Stat
              label="Engine status"
              value={isLoading || !stats ? null : "Live"}
              accent
            />
          </div>
        </Reveal>
      </section>

      {/* ===== Features ===== */}
      <section className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to{" "}
            <span className="text-gradient-accent">stay in range</span>
          </h2>
          <p className="mt-4 text-white/55">
            A focused toolkit for running concentrated liquidity like a
            professional — without the 24/7 screen time.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <div className="glass group h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/30 hover:shadow-glow-strong">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/15 to-cyan-400/15 text-xl">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps to auto-yield
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="glass relative h-full overflow-hidden rounded-2xl p-7">
                <div className="text-5xl font-bold text-white/20">
                  {s.n}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="mx-auto max-w-5xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-400/[0.08] via-base-800 to-cyan-400/[0.08] p-10 text-center sm:p-16">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Put your liquidity to work
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-white/55">
                Connect a wallet, deploy a position, and let the engine handle
                the rebalancing. Live on testnets now.
              </p>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-7 py-3.5 text-sm font-semibold text-base-900 shadow-[0_10px_40px_rgba(52,211,153,0.4)] transition-all duration-200 hover:brightness-110"
              >
                Launch the app →
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== Footer ===== */}
      <footer className="mx-auto max-w-6xl border-t border-white/5 pt-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm text-white/40">
            © {new Date().getFullYear()} LiquidAI · Testnet preview
          </span>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/pools" className="hover:text-white/80">
              Pools
            </Link>
            <Link href="/backtest" className="hover:text-white/80">
              Backtest
            </Link>
            <Link href="/status" className="hover:text-white/80">
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="bg-white/[0.015] p-6 text-center">
      <div className="text-[11px] uppercase tracking-wider text-white/35">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          accent ? "text-gradient-accent" : "text-white"
        }`}
      >
        {value ?? <Skeleton className="mx-auto h-7 w-20" />}
      </div>
    </div>
  );
}

/**
 * A polished, fake-but-plausible product preview that hints at the dashboard
 * without depending on the user's connected wallet. Purely decorative.
 */
function HeroMockup() {
  return (
    <div className="glass-strong relative overflow-hidden rounded-3xl border-white/10 p-2 shadow-glow-strong">
      <div className="rounded-2xl border border-white/5 bg-base-900/60 p-4 sm:p-6">
        {/* window chrome */}
        <div className="mb-5 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs text-white/30">
            app.liquidai · dashboard
          </span>
        </div>
        {/* header row */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/35">
              Total value managed
            </div>
            <div className="text-3xl font-semibold text-white">$128,420</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            engine live
          </div>
        </div>
        {/* stat chips */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { l: "Unclaimed fees", v: "$4,210", c: "text-emerald-300" },
            { l: "Avg fee APR", v: "31.4%", c: "text-cyan-300" },
            { l: "In range", v: "3 / 3", c: "text-white" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-white/35">
                {s.l}
              </div>
              <div className={`mt-1 text-lg font-semibold ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
        {/* fake position rows */}
        <div className="space-y-2">
          {[
            { p: "ETH / USDC", f: "0.3%", r: "in range", c: "text-emerald-300", w: "62%" },
            { p: "WBTC / ETH", f: "0.3%", r: "in range", c: "text-emerald-300", w: "48%" },
            { p: "DAI / USDC", f: "0.05%", r: "in range", c: "text-emerald-300", w: "71%" },
          ].map((row) => (
            <div
              key={row.p}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-400/30 to-cyan-400/30" />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{row.p}</div>
                <div className="text-[11px] text-white/40">{row.f} fee tier</div>
              </div>
              <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                  style={{ width: row.w }}
                />
              </div>
              <span className={`text-xs ${row.c}`}>{row.r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
