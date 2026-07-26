// src/lib/local-storage.ts
// v2.1: localStorage persistence layer for positions, settings, engine state,
// and HFT auto-range manager. Replaces all backend DB calls.

export interface LocalPosition {
  tokenId: string;
  pair: string;
  feeTier: number;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  amount0: number;
  amount1: number;
  valueUSD: number;
  unclaimedFeesUSD: number;
  fees24hUSD: number;
  entryPrice: number;
  createdAt: number;
  outOfRangeSince: number | null;
  chainId: number;
  // HFT auto-range manager state
  hftEnabled: boolean;
  hftTightnessPct: number;
}

export interface LocalSettings {
  aiApiBase: string;
  aiApiKey: string;
  aiModel: string;
  telegramBotToken: string;
  telegramChatId: string;
  defaultSlippagePct: number;
  preferredFeeTier: number;
  notificationsEnabled: boolean;
  onRebalance: boolean;
  onCompound: boolean;
  onStopLoss: boolean;
  onFailure: boolean;
  onOutOfRangeHrs: number | null;
}

export interface LocalEngineState {
  running: boolean;
  dryRun: boolean;
  updatedAt: number;
}

export interface HftRebalanceRecord {
  id: string;
  positionId: string;
  pair: string;
  ts: number;
  oldLower: number;
  oldUpper: number;
  newLower: number;
  newUpper: number;
  triggerPrice: number;
  aprAchieved: number;
  status: "executed" | "dry_run" | "skipped";
}

export interface LocalStrategyAction {
  id: string;
  positionId: string;
  chainId: number;
  ts: number;
  type: "REBALANCE" | "COMPOUND" | "STOP_LOSS" | "SKIPPED";
  status: "EXECUTED" | "FAILED" | "DRY_RUN";
  details: string;
}

const PREFIX = "liquidai:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded or unavailable
  }
}

// ---- Positions ----

export function getLocalPositions(): LocalPosition[] {
  return read<LocalPosition[]>("positions", []);
}

export function saveLocalPosition(pos: LocalPosition): void {
  const all = getLocalPositions();
  const idx = all.findIndex((p) => p.tokenId === pos.tokenId);
  if (idx >= 0) {
    all[idx] = pos;
  } else {
    all.unshift(pos);
  }
  write("positions", all);
}

export function removeLocalPosition(tokenId: string): void {
  const all = getLocalPositions().filter((p) => p.tokenId !== tokenId);
  write("positions", all);
}

export function updateLocalPosition(
  tokenId: string,
  patch: Partial<LocalPosition>
): LocalPosition | null {
  const all = getLocalPositions();
  const idx = all.findIndex((p) => p.tokenId === tokenId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  write("positions", all);
  return all[idx];
}

// ---- Settings ----

export const DEFAULT_SETTINGS: LocalSettings = {
  aiApiBase: "https://api.openai.com/v1",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  telegramBotToken: "",
  telegramChatId: "",
  defaultSlippagePct: 0.5,
  preferredFeeTier: 500,
  notificationsEnabled: false,
  onRebalance: true,
  onCompound: true,
  onStopLoss: true,
  onFailure: true,
  onOutOfRangeHrs: 4,
};

export function getSettings(): LocalSettings {
  return read<LocalSettings>("settings", DEFAULT_SETTINGS);
}

export function saveSettings(settings: LocalSettings): void {
  write("settings", settings);
}

export function validateSettings(s: LocalSettings): string[] {
  const errors: string[] = [];
  if (s.defaultSlippagePct < 0 || s.defaultSlippagePct > 50)
    errors.push("Slippage must be between 0% and 50%");
  if (s.preferredFeeTier !== 100 && s.preferredFeeTier !== 500 && s.preferredFeeTier !== 3000 && s.preferredFeeTier !== 10000)
    errors.push("Fee tier must be 0.01%, 0.05%, 0.30%, or 1%");
  if (s.aiApiBase) {
    try {
      new URL(s.aiApiBase);
    } catch {
      errors.push("AI API base URL is not a valid URL");
    }
  }
  if (s.onOutOfRangeHrs !== null && (s.onOutOfRangeHrs < 0 || s.onOutOfRangeHrs > 720))
    errors.push("Out-of-range hours must be between 0 and 720");
  return errors;
}

// ---- Engine State ----

export const DEFAULT_ENGINE: LocalEngineState = {
  running: false,
  dryRun: true,
  updatedAt: Date.now(),
};

export function getEngineState(): LocalEngineState {
  return read<LocalEngineState>("engine", DEFAULT_ENGINE);
}

export function saveEngineState(state: LocalEngineState): void {
  write("engine", state);
}

// ---- HFT Rebalance History ----

export function getHftHistory(): HftRebalanceRecord[] {
  return read<HftRebalanceRecord[]>("hft-history", []);
}

export function addHftRecord(rec: HftRebalanceRecord): void {
  const all = getHftHistory();
  all.unshift(rec);
  write("hft-history", all.slice(0, 100)); // keep last 100
}

// ---- Strategy Actions ----

export function getStrategyActions(): LocalStrategyAction[] {
  return read<LocalStrategyAction[]>("actions", []);
}

export function addStrategyAction(action: LocalStrategyAction): void {
  const all = getStrategyActions();
  all.unshift(action);
  write("actions", all.slice(0, 200));
}

// ---- Status check results cache ----

export interface StatusCheckResult {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  lastCheck: number;
  error: string | null;
}

export function getStatusCache(): StatusCheckResult[] {
  return read<StatusCheckResult[]>("status-cache", []);
}

export function saveStatusCache(results: StatusCheckResult[]): void {
  write("status-cache", results);
}
