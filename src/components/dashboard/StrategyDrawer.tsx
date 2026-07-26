// src/components/dashboard/StrategyDrawer.tsx
// Slide-out drawer for per-position strategy configuration + action log.
// Matches the existing dark luxury surfacemorphism aesthetic.
// v1.4: auth-gated (SIWE) — controls disabled with "Sign in to manage"
// tooltip when unauthenticated; adds one-click "Apply preset" chips.

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStrategy, useUpdateStrategy, useActions } from "@/hooks/useStrategy";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatNum, cn } from "@/lib/utils";
import { PRESETS } from "../../../shared/presets";
import type { StrategyActionDto } from "../../../shared/types";

interface Props {
  positionId: string | undefined;
  pair: string;
  tokenId: number;
  open: boolean;
  onClose: () => void;
}

export function StrategyDrawer({
  positionId,
  pair,
  tokenId,
  open,
  onClose,
}: Props) {
  const { data: cfg, isLoading } = useStrategy(open ? positionId : undefined);
  const update = useUpdateStrategy(open ? positionId : undefined);
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"config" | "actions">("config");

  // Local form state, synced when cfg loads.
  const [enabled, setEnabled] = useState(true);
  const [rebalanceHrs, setRebalanceHrs] = useState(6);
  const [compoundMin, setCompoundMin] = useState(10);
  const [maxSlippage, setMaxSlippage] = useState(0.5);
  const [stopLoss, setStopLoss] = useState<number | "">(10);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (cfg) {
      setEnabled(cfg.enabled);
      setRebalanceHrs(cfg.rebalanceAfterHrs);
      setCompoundMin(cfg.compoundMinUsd);
      setMaxSlippage(cfg.maxSlippagePct);
      setStopLoss(cfg.stopLossIlPct ?? "");
      setDirty(false);
    }
  }, [cfg]);

  function handleSave() {
    if (!positionId || !isAuthenticated) return;
    update.mutate({
      enabled,
      rebalanceAfterHrs: rebalanceHrs,
      compoundMinUsd: compoundMin,
      maxSlippagePct: maxSlippage,
      stopLossIlPct: stopLoss === "" ? null : stopLoss,
    });
    setDirty(false);
  }

  /** v1.4: write a preset's values into the local form (Save persists them). */
  function applyPreset(name: string) {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset || !isAuthenticated) return;
    setRebalanceHrs(preset.config.rebalanceAfterHrs);
    setCompoundMin(preset.config.compoundMinUsd);
    setMaxSlippage(preset.config.maxSlippagePct);
    setStopLoss(preset.config.stopLossIlPct ?? "");
    setDirty(true);
  }

  const gated = !isAuthenticated;
  const gateTitle = gated ? "Sign in to manage" : undefined;

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={
          "fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto " +
          "border-l border-ink/10 bg-surface-page95 backdrop-blur-2xl " +
          "transition-transform duration-300 ease-out " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-surface-page px-6 py-4 backdrop-blur-xl">
          <div>
            <h3 className="text-sm font-medium text-ink-soft">
              Strategy · {pair}
            </h3>
            <p className="text-xs text-ink-muted">#{tokenId}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink-muted transition hover:bg-ink/[0.04] hover:text-ink-soft"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 border-b border-ink/10 px-6 py-3">
          <TabButton active={tab === "config"} onClick={() => setTab("config")}>
            Config
          </TabButton>
          <TabButton active={tab === "actions"} onClick={() => setTab("actions")}>
            Action Log
          </TabButton>
        </div>

        <div className="p-6">
          {tab === "config" && (
            <>
              {isLoading || !cfg ? (
                <div className="space-y-4">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : (
                <div className="space-y-6">
                  {gated && (
                    <div className="rounded-xl border border-cyan-400/15 bg-brand-500/[0.04] px-4 py-3 text-xs text-cyan-200/80">
                      Connect your wallet and sign in to manage this strategy.
                    </div>
                  )}

                  {/* v1.4: Apply preset chips */}
                  <div
                    className={cn(
                      "rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-4",
                      gated && "opacity-40"
                    )}
                    title={gateTitle}
                  >
                    <div className="mb-3 text-sm font-medium text-ink/70">
                      Apply preset
                    </div>
                    <div className="flex gap-2">
                      {PRESETS.map((p) => (
                        <button
                          key={p.name}
                          onClick={() => applyPreset(p.name)}
                          disabled={gated}
                          title={gateTitle ?? p.description}
                          className={cn(
                            "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
                            "border-ink/10 bg-ink/[0.03] text-ink/70",
                            !gated &&
                              "hover:border-emerald-400/40 hover:text-ink",
                            gated && "cursor-not-allowed"
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Enable toggle */}
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3",
                      gated && "opacity-40"
                    )}
                    title={gateTitle}
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-soft">
                        Automation enabled
                      </div>
                      <div className="text-xs text-ink-muted">
                        Worker will evaluate rules on each tick
                      </div>
                    </div>
                    <Toggle
                      checked={enabled}
                      disabled={gated}
                      onChange={(v) => {
                        setEnabled(v);
                        setDirty(true);
                      }}
                    />
                  </div>

                  {/* Rebalance hours slider */}
                  <SliderField
                    label="Rebalance after (hours out of range)"
                    value={rebalanceHrs}
                    min={0}
                    max={48}
                    step={1}
                    disabled={gated}
                    title={gateTitle}
                    onChange={(v) => {
                      setRebalanceHrs(v);
                      setDirty(true);
                    }}
                    suffix="h"
                  />

                  {/* Compound min slider */}
                  <SliderField
                    label="Auto-compound min (USD)"
                    value={compoundMin}
                    min={0}
                    max={100}
                    step={1}
                    disabled={gated}
                    title={gateTitle}
                    onChange={(v) => {
                      setCompoundMin(v);
                      setDirty(true);
                    }}
                    prefix="$"
                  />

                  {/* Max slippage slider */}
                  <SliderField
                    label="Max slippage (%)"
                    value={maxSlippage}
                    min={0}
                    max={5}
                    step={0.1}
                    disabled={gated}
                    title={gateTitle}
                    onChange={(v) => {
                      setMaxSlippage(v);
                      setDirty(true);
                    }}
                    suffix="%"
                  />

                  {/* Stop loss input */}
                  <div
                    className={cn(
                      "rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-4",
                      gated && "opacity-40"
                    )}
                    title={gateTitle}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-ink/70">
                        Stop-loss IL threshold (%)
                      </span>
                      <span className="text-xs text-ink-muted">
                        Close position if IL exceeds this
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={stopLoss}
                        disabled={gated}
                        onChange={(e) => {
                          const v = e.target.value;
                          setStopLoss(v === "" ? "" : Number(v));
                          setDirty(true);
                        }}
                        placeholder="Disabled"
                        className="w-24 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2 text-sm tabular-nums text-ink outline-none focus:border-emerald-400/40 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs text-ink-muted">
                        Leave empty to disable
                      </span>
                    </div>
                  </div>

                  <div title={gateTitle}>
                    <Button
                      onClick={handleSave}
                      disabled={gated || !dirty || update.isPending}
                      className="w-full"
                    >
                      {gated
                        ? "Sign in to manage"
                        : update.isPending
                          ? "Saving…"
                          : update.isSuccess
                            ? "Saved ✓"
                            : "Save strategy"}
                    </Button>
                  </div>

                  {update.isError && (
                    <p className="text-center text-xs text-negative">
                      Failed to save: {(update.error as Error).message}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {tab === "actions" && (
            <ActionLogTimeline positionId={open ? positionId : undefined} />
          )}
        </div>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-lg px-4 py-2 text-xs font-medium transition " +
        (active
          ? "bg-ink/[0.04] text-ink"
          : "text-ink-muted hover:text-ink/70")
      }
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={
        "relative h-7 w-12 rounded-full transition disabled:cursor-not-allowed " +
        (checked
          ? "bg-gradient-to-r from-brand-500 to-brand-400"
          : "bg-ink/[0.06]")
      }
    >
      <span
        className={
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition " +
          (checked ? "left-6" : "left-1")
        }
      />
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = "",
  suffix = "",
  disabled,
  title,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-4",
        disabled && "opacity-40"
      )}
      title={title}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink/70">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 rounded border border-ink/10 bg-ink/[0.03] px-2 py-1 text-right text-sm tabular-nums text-ink outline-none focus:border-emerald-400/40 disabled:cursor-not-allowed"
          />
          <span className="text-xs tabular-nums text-ink-muted">
            {prefix}
            {formatNum(value, step < 1 ? 1 : 0)}
            {suffix}
          </span>
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full disabled:cursor-not-allowed"
      />
    </div>
  );
}

function ActionLogTimeline({
  positionId,
}: {
  positionId: string | undefined;
}) {
  const { data, isLoading } = useActions(positionId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (!data || data.actions.length === 0) {
    return (
      <div className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-8 text-center">
        <p className="text-sm text-ink-muted">No actions recorded yet</p>
        <p className="mt-1 text-xs text-ink-faint">
          The strategy worker logs every decision here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.actions.map((a) => (
        <ActionRow key={a.id} action={a} />
      ))}
      {data.hasMore && (
        <p className="pt-2 text-center text-xs text-ink-faint">
          {data.total} total · showing latest {data.actions.length}
        </p>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: StrategyActionDto }) {
  const color =
    action.status === "EXECUTED"
      ? "text-[#22892F] bg-[#22892F]/10"
      : action.status === "FAILED"
        ? "text-negative bg-negative/10"
        : "text-ink-muted bg-ink/[0.04]";

  let detail = "";
  try {
    detail = (JSON.parse(action.detailsJson) as { reason?: string }).reason ?? "";
  } catch {
    // ignore parse errors
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2.5">
      <div className={"mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-bold " + color}>
        {action.status}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-soft">
            {action.type}
          </span>
          <span className="text-[10px] text-ink-faint">
            {new Date(action.ts).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {detail && (
          <p className="mt-0.5 truncate text-xs text-ink-muted">{detail}</p>
        )}
        {action.txHash && (
          <p className="mt-0.5 truncate font-mono text-[10px] text-brand-500/60">
            {action.txHash.slice(0, 18)}…
          </p>
        )}
      </div>
    </div>
  );
}
