// shared/presets.ts
// v1.4: Three strategy presets for backtesting comparison and one-click apply.
// Shared between the frontend (preset cards, backtest page) and backend.

import type { PresetName, StrategyPreset } from "./types";

/**
 * Conservative: wide range (±15%), infrequent rebalancing (24h), high compound
 * threshold ($25), tight slippage, aggressive stop-loss at 5% IL.
 */
const CONSERVATIVE: StrategyPreset = {
  name: "conservative",
  label: "Conservative",
  description: "Wide range, low maintenance, capital protection",
  rangeWidthPct: 30,
  config: {
    rebalanceAfterHrs: 24,
    compoundMinUsd: 25,
    maxSlippagePct: 0.3,
    stopLossIlPct: 5,
  },
};

/**
 * Balanced: moderate range (±7.5%), rebalance every 6h, compound at $10.
 * The default middle-ground for most pools.
 */
const BALANCED: StrategyPreset = {
  name: "balanced",
  label: "Balanced",
  description: "Moderate range, regular rebalancing, balanced risk",
  rangeWidthPct: 15,
  config: {
    rebalanceAfterHrs: 6,
    compoundMinUsd: 10,
    maxSlippagePct: 0.5,
    stopLossIlPct: 10,
  },
};

/**
 * Aggressive: narrow range (±3%), frequent rebalancing (2h), low compound
 * threshold ($5), no stop-loss. Maximizes fee capture in stable ranges.
 */
const AGGRESSIVE: StrategyPreset = {
  name: "aggressive",
  label: "Aggressive",
  description: "Narrow range, high fee capture, no stop-loss",
  rangeWidthPct: 6,
  config: {
    rebalanceAfterHrs: 2,
    compoundMinUsd: 5,
    maxSlippagePct: 1.0,
    stopLossIlPct: null,
  },
};

/** All presets in display order. */
export const PRESETS: StrategyPreset[] = [CONSERVATIVE, BALANCED, AGGRESSIVE];

/** Lookup map by name. */
export const PRESET_MAP: Record<PresetName, StrategyPreset> = {
  conservative: CONSERVATIVE,
  balanced: BALANCED,
  aggressive: AGGRESSIVE,
};

/** Get a preset by name. Throws for unknown names. */
export function getPreset(name: PresetName): StrategyPreset {
  const preset = PRESET_MAP[name];
  if (!preset) throw new Error(`unknown preset: ${name}`);
  return preset;
}
