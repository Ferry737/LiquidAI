// src/components/backtest/Backtest.tsx
// v2.1: Client-side backtester — fetches historical price data from CoinGecko
// (or deterministic synthetic data), runs real Uniswap V3 LP math locally.
// Conservative/Balanced/Aggressive comparison + Custom mode. No backend needed.

"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePools } from "@/hooks/usePools";
import {
  runComparisonClient,
  runBacktestClient,
  getCoinId,
  fetchPriceHistory,
} from "@/lib/client-api";
import { PRESETS } from "../../../shared/presets";
import type { PresetName, StrategyPreset } from "../../../shared/types";
import { cn, formatUSD, formatPct } from "@/lib/utils";

const PRESET_COLORS: Record<PresetName, string> = {
  conservative: "#34d399",
  balanced: "#22d3ee",
  aggressive: "#fbbf24",
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface ComparisonRow {
  preset: StrategyPreset;
  result: import("../../../shared/types").BacktestResult;
}

function toDateInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function Backtest() {
  const { data: poolsData, isLoading: poolsLoading } = usePools();
  const pools = poolsData?.pools;

  const [poolId, setPoolId] = useState("");
  const [from, setFrom] = useState(() => toDateInput(Date.now() - 30 * DAY_MS));
  const [to, setTo] = useState(() => toDateInput(Date.now()));
  const [initialUsd, setInitialUsd] = useState(10_000);

  // Custom mode
  const [customMode, setCustomMode] = useState(false);
  const [customRangeWidth, setCustomRangeWidth] = useState(15);
  const [customRebalanceHrs, setCustomRebalanceHrs] = useState(6);
  const [customCompoundMin, setCustomCompoundMin] = useState(10);
  const [customSlippage, setCustomSlippage] = useState(0.5);
  const [customStopLoss, setCustomStopLoss] = useState<number | "">(10);

  const [rows, setRows] = useState<ComparisonRow[] | null>(null);
  const [customResult, setCustomResult] = useState<import("../../../shared/types").BacktestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPool = pools?.find((p) => p.id === poolId) ?? null;

  async function handleComparison() {
    if (!poolId) return;
    setRunning(true);
    setError(null);
    try {
      const days = Math.round(
        (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS
      );
      const coinId = selectedPool
        ? getCoinId(selectedPool.pair)
        : "ethereum";
      const results = await runComparisonClient(coinId, days, initialUsd);
      setRows(results);
      setCustomResult(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleCustom() {
    if (!poolId) return;
    setRunning(true);
    setError(null);
    try {
      const days = Math.round(
        (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS
      );
      const coinId = selectedPool ? getCoinId(selectedPool.pair) : "ethereum";
      const history = await fetchPriceHistory(coinId, days);
      const result = runBacktestClient(history, {
        initialUsd,
        rangeWidthPct: customRangeWidth,
        backtestConfig: {
          rebalanceAfterHrs: customRebalanceHrs,
          compoundMinUsd: customCompoundMin,
          maxSlippagePct: customSlippage,
          stopLossIlPct: customStopLoss === "" ? null : customStopLoss,
        },
      });
      setCustomResult(result);
      setRows(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const canRun = !!poolId && !running;

  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const byTs = new Map<number, Record<string, number>>();
    for (const { preset, result } of rows) {
      for (const point of result.series) {
        const entry = byTs.get(point.ts) ?? { ts: point.ts };
        entry[preset.name] = point.valueUsd;
        entry.hodl = point.hodlUsd;
        byTs.set(point.ts, entry);
      }
    }
    return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
  }, [rows]);

  const winner = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return rows.reduce((best, r) =>
      r.result.netVsHodlPct > best.result.netVsHodlPct ? r : best
    );
  }, [rows]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-muted">
          Replay historical pool data and compare strategy presets against HODL.
          Uses real Uniswap V3 IL formulas and fee capture math. Data from CoinGecko public API.
        </p>
      </div>

      {/* Parameters */}
      <Card hover={false}>
        <CardBody className="space-y-6">
          <CardTitle>Parameters</CardTitle>

          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-medium text-ink-muted">Pool</span>
              {poolsLoading ? (
                <Skeleton className="h-10" />
              ) : (
                <select
                  value={poolId}
                  onChange={(e) => setPoolId(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-surface-page px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500/30"
                >
                  <option value="">Select a pool…</option>
                  {pools?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.pair} · {p.chain} · {formatUSD(p.tvlUsd)} TVL
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">From</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500/30"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">To</span>
              <input
                type="date"
                value={to}
                min={from}
                max={toDateInput(Date.now())}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500/30"
              />
            </label>
          </div>

          <label className="block max-w-xs space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Initial amount (USD)</span>
            <input
              type="number"
              min={1}
              max={10_000_000}
              value={initialUsd}
              onChange={(e) => setInitialUsd(Number(e.target.value))}
              className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm tabular-nums text-ink outline-none focus:border-brand-500/30"
            />
          </label>
        </CardBody>
      </Card>

      {/* Preset cards + custom mode */}
      <div className="grid gap-4 md:grid-cols-4">
        {PRESETS.map((p) => (
          <Card key={p.name} hover={!customMode} className={cn("transition-all", customMode && "opacity-40")}>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PRESET_COLORS[p.name], boxShadow: `0 0 10px ${PRESET_COLORS[p.name]}80` }}
                />
                <span className="text-sm font-semibold">{p.label}</span>
              </div>
              <p className="text-xs leading-relaxed text-ink-muted">{p.description}</p>
              <dl className="space-y-1 text-xs text-ink-muted">
                <div className="flex justify-between"><dt className="text-ink-faint">Range width</dt><dd className="tabular-nums">±{p.rangeWidthPct / 2}%</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Rebalance after</dt><dd className="tabular-nums">{p.config.rebalanceAfterHrs}h</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Compound min</dt><dd className="tabular-nums">${p.config.compoundMinUsd}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-faint">Stop-loss IL</dt><dd className="tabular-nums">{p.config.stopLossIlPct !== null ? `${p.config.stopLossIlPct}%` : "—"}</dd></div>
              </dl>
            </CardBody>
          </Card>
        ))}

        <Card hover={false} className={cn(customMode && "border-[#22892F]/30")}>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Custom</span>
              <button
                onClick={() => setCustomMode((v) => !v)}
                className={cn("rounded-lg px-2.5 py-1 text-[11px] font-medium transition", customMode ? "bg-[#22892F]/10 text-[#22892F]" : "bg-ink/[0.04] text-ink-muted hover:text-ink-soft")}
              >
                {customMode ? "Enabled" : "Enable"}
              </button>
            </div>
            <div className={cn("space-y-2", !customMode && "opacity-40")}>
              <MiniField label="Range width %" value={customRangeWidth} onChange={setCustomRangeWidth} disabled={!customMode} />
              <MiniField label="Rebalance hrs" value={customRebalanceHrs} onChange={setCustomRebalanceHrs} disabled={!customMode} />
              <MiniField label="Compound $" value={customCompoundMin} onChange={setCustomCompoundMin} disabled={!customMode} />
              <MiniField label="Slippage %" value={customSlippage} onChange={setCustomSlippage} disabled={!customMode} step={0.1} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-muted">Stop-loss %</span>
                <input
                  type="number"
                  value={customStopLoss}
                  placeholder="off"
                  disabled={!customMode}
                  onChange={(e) => setCustomStopLoss(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-20 rounded-lg border border-ink/10 bg-ink/[0.03] px-2 py-1 text-right text-xs tabular-nums text-ink outline-none focus:border-brand-500/30 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Run buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {customMode ? (
          <Button onClick={() => void handleCustom()} disabled={!canRun}>
            {running ? "Running…" : "Run custom backtest"}
          </Button>
        ) : (
          <Button onClick={() => void handleComparison()} disabled={!canRun}>
            {running ? "Running comparison…" : "Run comparison"}
          </Button>
        )}
        {error && <span className="text-xs text-negative">{error}</span>}
      </div>

      {/* Chart + results (comparison mode) */}
      {rows && rows.length > 0 && (
        <>
          <Card hover={false}>
            <CardBody>
              <CardTitle className="mb-4">Value over time</CardTitle>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="ts"
                      tickFormatter={(ts: number) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      stroke="rgba(255,255,255,0.25)"
                      fontSize={11}
                    />
                    <YAxis tickFormatter={(v: number) => formatUSD(v)} stroke="rgba(255,255,255,0.25)" fontSize={11} width={72} />
                    <Tooltip
                      contentStyle={{ background: "rgba(10,12,16,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                      labelFormatter={(ts) => new Date(Number(ts)).toLocaleString()}
                      formatter={(value) => formatUSD(Number(value), false)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {PRESETS.map((p) => (
                      <Line key={p.name} type="monotone" dataKey={p.name} name={p.label} stroke={PRESET_COLORS[p.name]} strokeWidth={2} dot={false} />
                    ))}
                    <Line type="monotone" dataKey="hodl" name="HODL" stroke="rgba(255,255,255,0.45)" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          {winner && (
            <Card hover={false} className="border-[#22892F]/25 shadow-card">
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PRESET_COLORS[winner.preset.name], boxShadow: `0 0 14px ${PRESET_COLORS[winner.preset.name]}` }} />
                  <div>
                    <div className="text-sm font-semibold">{winner.preset.label} wins{selectedPool ? ` on ${selectedPool.pair}` : ""}</div>
                    <div className="text-xs text-ink-muted">Best net performance vs HODL</div>
                  </div>
                </div>
                <div className={cn("text-2xl font-semibold tabular-nums", winner.result.netVsHodlPct >= 0 ? "text-[#22892F]" : "text-negative")}>
                  {formatPct(winner.result.netVsHodlPct)}
                </div>
              </CardBody>
            </Card>
          )}

          <Card hover={false}>
            <CardBody className="overflow-x-auto">
              <CardTitle className="mb-4">Results</CardTitle>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs text-ink-muted">
                    <th className="pb-3 font-medium">Preset</th>
                    <th className="pb-3 font-medium">Net vs HODL</th>
                    <th className="pb-3 font-medium">Final value</th>
                    <th className="pb-3 font-medium">Fees earned</th>
                    <th className="pb-3 font-medium">IL vs HODL</th>
                    <th className="pb-3 font-medium">Rebalances</th>
                    <th className="pb-3 font-medium">Gas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ preset, result }) => (
                    <tr key={preset.name} className="border-b border-ink/10 last:border-0">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRESET_COLORS[preset.name] }} />
                          {preset.label}
                        </span>
                      </td>
                      <td className={cn("py-3 tabular-nums", result.netVsHodlPct >= 0 ? "text-[#22892F]" : "text-negative")}>{formatPct(result.netVsHodlPct)}</td>
                      <td className="py-3 tabular-nums text-ink-soft">{formatUSD(result.finalValueUsd, false)}</td>
                      <td className="py-3 tabular-nums text-ink-soft">{formatUSD(result.feesEarnedUsd, false)}</td>
                      <td className="py-3 tabular-nums text-ink-muted">{formatUSD(result.ilUsd, false)}</td>
                      <td className="py-3 tabular-nums text-ink-muted">{result.rebalanceCount}</td>
                      <td className="py-3 tabular-nums text-ink-muted">{formatUSD(result.gasSpentUsd, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      )}

      {/* Custom result */}
      {customResult && (
        <Card hover={false}>
          <CardBody className="space-y-4">
            <CardTitle>Custom backtest result</CardTitle>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Net vs HODL" value={formatPct(customResult.netVsHodlPct)} highlight={customResult.netVsHodlPct >= 0} />
              <Stat label="Final value" value={formatUSD(customResult.finalValueUsd, false)} />
              <Stat label="HODL value" value={formatUSD(customResult.hodlValueUsd, false)} />
              <Stat label="Fees earned" value={formatUSD(customResult.feesEarnedUsd, false)} />
              <Stat label="Rebalances" value={String(customResult.rebalanceCount)} />
              <Stat label="Gas spent" value={formatUSD(customResult.gasSpentUsd, false)} />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function MiniField({ label, value, onChange, disabled, step = 1 }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; step?: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-ink-muted">{label}</span>
      <input type="number" value={value} step={step} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="w-20 rounded-lg border border-ink/10 bg-ink/[0.03] px-2 py-1 text-right text-xs tabular-nums text-ink outline-none focus:border-brand-500/30 disabled:cursor-not-allowed" />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3">
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className={cn("mt-1 text-sm font-semibold tabular-nums", highlight === undefined ? "text-ink/85" : highlight ? "text-[#22892F]" : "text-negative")}>{value}</div>
    </div>
  );
}
