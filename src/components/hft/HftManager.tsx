// src/components/hft/HftManager.tsx
// v2.1: HFT Auto-Range Manager — autonomous background monitor for every
// open position. If spot price exits the tick range, automatically calculates
// a new centered, tighter profitable range and simulates a rebalance.
// UI shows toggle (on/off), tightness target, rebalance history, APR achieved.

"use client";

import { useHftManager } from "@/hooks/useHftManager";
import { usePositions } from "@/hooks/usePositions";
import { getLocalPositions } from "@/lib/local-storage";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, formatUSD, formatPct, formatNum } from "@/lib/utils";
import { useState } from "react";

export function HftManager() {
  const { state, toggle, setTightness } = useHftManager();
  const { data: positions } = usePositions();
  const [refreshKey, setRefreshKey] = useState(0);

  // Get HFT-enabled status from localStorage (refreshed periodically)
  const localPositions = getLocalPositions();

  return (
    <div className="space-y-8">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            Monitoring
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {state.monitoringCount}
          </div>
          <div className="text-xs text-ink-faint">positions</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            Total Rebalances
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-brand-500">
            {state.totalRebalances}
          </div>
          <div className="text-xs text-ink-faint">auto-executed</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            Avg APR Achieved
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[#1F8A4C]">
            {state.avgApr > 0 ? formatPct(state.avgApr) : "—"}
          </div>
          <div className="text-xs text-ink-faint">across rebalances</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-ink-muted">
            Last Check
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {state.lastCheckTs
              ? `${Math.round((Date.now() - state.lastCheckTs) / 1000)}s`
              : "—"}
          </div>
          <div className="text-xs text-ink-faint">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1F8A4C]" /> active
          </div>
        </Card>
      </div>

      {/* Position toggles */}
      <Card hover={false}>
        <CardBody className="space-y-4">
          <CardTitle>Position Auto-Range Monitor</CardTitle>
          <p className="text-sm text-ink-muted">
            Enable HFT auto-ranging on individual positions. When the spot price exits
            the tick range, the engine recalculates a tighter, centered range and simulates
            a rebalance (remove liquidity + re-add). Runs every 30 seconds.
          </p>

          {positions && positions.length > 0 ? (
            <div className="space-y-3">
              {positions.map((p) => {
                const local = localPositions.find(
                  (lp) => lp.tokenId === String(p.tokenId)
                );
                const hftEnabled = local?.hftEnabled ?? false;
                const tightness = local?.hftTightnessPct ?? 3;
                return (
                  <div
                    key={p.tokenId}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3"
                  >
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.pair}</span>
                        <span className="text-xs text-ink-muted">
                          #{p.tokenId}
                        </span>
                        {p.inRange ? (
                          <span className="rounded-full bg-[#1F8A4C]/10 px-2 py-0.5 text-xs text-[#1F8A4C]">
                            in range
                          </span>
                        ) : (
                          <span className="rounded-full bg-negative/10 px-2 py-0.5 text-xs text-negative">
                            out of range
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-ink-muted">
                        Range: {formatNum(p.lowerPrice)} – {formatNum(p.upperPrice)} · Current: {formatNum(p.currentPrice)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {hftEnabled && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-muted">Tightness</span>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={tightness}
                            onChange={(e) => {
                              setTightness(String(p.tokenId), Number(e.target.value));
                              setRefreshKey((k) => k + 1);
                            }}
                            className="w-20 accent-brand-500"
                          />
                          <span className="text-xs tabular-nums w-8">
                            ±{tightness}%
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          toggle(String(p.tokenId), !hftEnabled);
                          setRefreshKey((k) => k + 1);
                        }}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
                          hftEnabled
                            ? "bg-gradient-to-r from-brand-500 to-brand-400"
                            : "bg-ink/[0.06]"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200",
                            hftEnabled ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-8 text-center text-sm text-ink-muted">
              No positions yet. Create a position first to enable HFT auto-ranging.
            </div>
          )}
        </CardBody>
      </Card>

      {/* Rebalance history */}
      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-ink-muted">
          Rebalance History
        </h2>
        {state.history.length === 0 ? (
          <Card hover={false}>
            <CardBody className="py-8 text-center text-sm text-ink-muted">
              No rebalances yet. Enable HFT on a position above to start monitoring.
            </CardBody>
          </Card>
        ) : (
          <Card hover={false} className="overflow-hidden">
            <div className="grid grid-cols-12 gap-4 border-b border-ink/10 px-6 py-4 text-xs uppercase tracking-wider text-ink-muted">
              <div className="col-span-3">Pair</div>
              <div className="col-span-2 text-right">Trigger</div>
              <div className="col-span-2 text-right">Old Range</div>
              <div className="col-span-2 text-right">New Range</div>
              <div className="col-span-1 text-right">APR</div>
              <div className="col-span-2 text-right">Time</div>
            </div>
            {state.history.map((rec) => (
              <div
                key={rec.id}
                className="grid grid-cols-12 gap-4 border-b border-ink/5 px-6 py-3 text-sm last:border-0"
              >
                <div className="col-span-3 font-medium">{rec.pair}</div>
                <div className="col-span-2 text-right tabular-nums text-negative">
                  ${formatNum(rec.triggerPrice)}
                </div>
                <div className="col-span-2 text-right tabular-nums text-ink-muted">
                  {formatNum(rec.oldLower)}–{formatNum(rec.oldUpper)}
                </div>
                <div className="col-span-2 text-right tabular-nums text-brand-500">
                  {formatNum(rec.newLower)}–{formatNum(rec.newUpper)}
                </div>
                <div className="col-span-1 text-right tabular-nums text-[#1F8A4C]">
                  {formatPct(rec.aprAchieved)}
                </div>
                <div className="col-span-2 text-right text-xs text-ink-muted">
                  {new Date(rec.ts).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Hidden refresh trigger */}
      <span className="hidden" data-refresh={refreshKey} />
    </div>
  );
}
