// worker/config.ts
// Environment-driven configuration for the AI Strategy Engine.
// v1.3: adds TELEGRAM_BOT_TOKEN and SEPOLIA_RPC_URL.

import "dotenv/config";

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v.toLowerCase() === "true" || v === "1";
}

function num(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  rpc: process.env.SEPOLIA_RPC || process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
  privateKey: (process.env.WORKER_PRIVATE_KEY ||
    "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
  killSwitch: bool(process.env.STRATEGY_KILL_SWITCH, false),
  maxSlippageBps: num(process.env.MAX_SLIPPAGE_BPS, 50),
  rebalanceAfterHours: num(process.env.REBALANCE_AFTER_HOURS, 6),
  compoundMinUsd: num(process.env.COMPOUND_MIN_USD, 10),
  // Run every 5 minutes by default.
  cronExpr: process.env.STRATEGY_CRON || "*/5 * * * *",
  // v1.2: DB for persistence (optional — worker still runs without it).
  databaseUrl: process.env.DATABASE_URL || "",
  chainId: num(process.env.CHAIN_ID, 11155111),
  // When true (default), log all decisions as DRY_RUN without executing on-chain.
  dryRun: bool(process.env.WORKER_DRY_RUN, true),
  // v1.3: Telegram bot token for notifications
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
};
