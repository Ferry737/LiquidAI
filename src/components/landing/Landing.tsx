// src/components/landing/Landing.tsx — SaaSable light theme (v1.9)
"use client";

import Link from "next/link";
import { useProtocolStats } from "@/hooks/useProtocolStats";
import { Reveal } from "@/components/ui/Reveal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatUSD } from "@/lib/utils";
import { Wordmark } from "./Logo";

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
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <section className="relative text-center">
        <div className="mb-8 flex justify-center">
          <Wordmark className="text-xl" />
        </div>
        <Reveal className="mx-auto max-w-3xl" duration={0.6}>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-4 py-1.5 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            Autonomous Uniswap v3 liquidity management
          </span>
        </Reveal>
        <Reveal className="mx-auto mt-6 max-w-3xl" duration={0.7}>
          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Liquidity that{" "}
            <span className="text-brand-gradient">manages itself</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-ink-muted">
            LiquidAI auto-creates and rebalances Uniswap v3 concentrated
            liquidity positions with a rule-based AI strategy engine — so you
            capture more fees with far less drift.
          </p>
        </Reveal>
        <Reveal className="mt-9 flex flex-wrap items-center justify-center gap-3" delay={0.15}>
          <Link
            href="/dashboard"
            className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(96,107,223,0.32)] transition-all duration-200 hover:bg-brand-600 hover:brightness-105"
          >
            Launch the app →
          </Link>
          <Link
            href="/backtest"
            className="rounded-xl border border-ink/10 bg-white px-6 py-3 text-sm font-semibold text-ink-soft transition-all duration-200 hover:bg-surface-page hover:text-ink"
          >
            Run a backtest
          </Link>
        </Reveal>

        <Reveal className="mx-auto mt-14 max-w-4xl" delay={0.2}>
          <HeroMockup />
        </Reveal>
      </section>

      {/* Live protocol stats */}
      <section className="mx-auto mt-20 max-w-4xl">
        <Reveal>
          <div className="surface grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
            <Stat
              label="Uniswap v3 TVL"
              value={isLoading || !stats ? null : formatUSD(stats.protocolTvlUSD)}
            />
            <Stat
              label="24h volume"
              value={isLoading || !stats ? null : formatUSD(stats.volume24hUSD)}
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

      {/* Features */}
      <section className="mx-auto mt-24 max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Everything you need to{" "}
            <span className="text-brand-500">stay in range</span>
          </h2>
          <p className="mt-4 text-ink-muted">
            A focused toolkit for running concentrated liquidity like a
            professional — without the 24/7 screen time.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <div className="surface group h-full rounded-2xl p-6 transition-all duration-200 hover:border-surface-muted hover:shadow-card-hover">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-raised border border-surface-muted text-xl">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto mt-24 max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Three steps to auto-yield
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="surface relative h-full overflow-hidden rounded-2xl p-7">
                <div className="text-5xl font-bold text-brand-100">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto mt-24 max-w-5xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-surface-muted bg-surface-raised p-10 text-center sm:p-16">
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Put your liquidity to work
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-ink-muted">
                Connect a wallet, deploy a position, and let the engine handle
                the rebalancing. Live on testnets now.
              </p>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex rounded-xl bg-brand-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(96,107,223,0.32)] transition-all duration-200 hover:bg-brand-600 hover:brightness-105"
              >
                Launch the app →
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="mx-auto mt-20 max-w-6xl border-t border-ink/10 pt-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-sm text-ink-muted">
            © {new Date().getFullYear()} LiquidAI · Testnet preview
          </span>
          <div className="flex items-center gap-6 text-sm text-ink-muted">
            <Link href="/pools" className="hover:text-ink">
              Pools
            </Link>
            <Link href="/backtest" className="hover:text-ink">
              Backtest
            </Link>
            <Link href="/status" className="hover:text-ink">
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
    <div className="bg-white p-6 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold ${
          accent ? "text-brand-500" : "text-ink"
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
    <div className="surface-raised relative overflow-hidden rounded-3xl border-brand-100 p-2">
      <div className="rounded-2xl border border-brand-100 bg-white p-4 sm:p-6">
        {/* window chrome */}
        <div className="mb-5 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-negative/70" />
          <span className="h-3 w-3 rounded-full bg-[#B26A00]/70" />
          <span className="h-3 w-3 rounded-full bg-[#1F8A4C]/70" />
          <span className="ml-3 text-xs text-ink-faint">app.liquidai · dashboard</span>
        </div>
        {/* header row */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
              Total value managed
            </div>
            <div className="text-3xl font-semibold text-ink tabular">—</div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-positive/10 px-3 py-1 text-xs font-medium text-positive">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            engine live
          </div>
        </div>
        {/* stat chips */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { l: "Unclaimed fees", v: "—", c: "text-positive" },
            { l: "Avg fee APR", v: "—", c: "text-brand-500" },
            { l: "In range", v: "—", c: "text-ink" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-xl border border-surface-muted bg-surface-raised p-3"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                {s.l}
              </div>
              <div className={`mt-1 text-lg font-semibold tabular ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
        {/* illustrative position rows (preview only — no real data) */}
        <div className="space-y-2">
          {[
            { p: "ETH / USDC", f: "0.3%" },
            { p: "WBTC / ETH", f: "0.3%" },
            { p: "DAI / USDC", f: "0.05%" },
          ].map((row) => (
            <div
              key={row.p}
              className="flex items-center gap-3 rounded-xl border border-surface-muted bg-white px-3 py-2.5"
            >
              <div className="h-7 w-7 rounded-lg bg-surface-raised border border-surface-muted" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{row.p}</div>
                <div className="text-[11px] text-ink-faint">{row.f} fee tier</div>
              </div>
              <span className="text-xs font-medium text-ink-faint">preview</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
