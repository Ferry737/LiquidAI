// src/hooks/useStatus.ts
// v2.1: Client-side health checker. Polls RPC, Subgraph, CoinGecko, and
// Telegram endpoints every 30 seconds. Real connectivity data, not static.

"use client";

import { useQuery } from "@tanstack/react-query";
import { CHAINS } from "../../shared/chains";

export interface DependencyCheck {
  name: string;
  label: string;
  status: "ok" | "degraded" | "down";
  latencyMs: number;
  lastCheck: number;
  error: string | null;
}

export interface StatusCheckResult {
  dependencies: DependencyCheck[];
  ts: number;
}

async function checkEndpoint(
  name: string,
  label: string,
  url: string,
  options?: RequestInit
): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - start);

    if (res.ok) {
      return { name, label, status: "ok", latencyMs, lastCheck: Date.now(), error: null };
    }
    return {
      name,
      label,
      status: "degraded",
      latencyMs,
      lastCheck: Date.now(),
      error: `HTTP ${res.status}`,
    };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      name,
      label,
      status: "down",
      latencyMs,
      lastCheck: Date.now(),
      error: (e as Error).message?.slice(0, 100) || "Connection failed",
    };
  }
}

async function checkRpc(): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(CHAINS.sepolia.defaultRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      const json = await res.json();
      if (json.result) {
        return { name: "rpc", label: "Sepolia RPC", status: "ok", latencyMs, lastCheck: Date.now(), error: null };
      }
    }
    return { name: "rpc", label: "Sepolia RPC", status: "degraded", latencyMs, lastCheck: Date.now(), error: "No result" };
  } catch (e) {
    return {
      name: "rpc",
      label: "Sepolia RPC",
      status: "down",
      latencyMs: Math.round(performance.now() - start),
      lastCheck: Date.now(),
      error: (e as Error).message?.slice(0, 100) || "Connection failed",
    };
  }
}

async function checkTelegram(botToken: string): Promise<DependencyCheck> {
  if (!botToken) {
    return {
      name: "telegram",
      label: "Telegram Bot API",
      status: "down",
      latencyMs: 0,
      lastCheck: Date.now(),
      error: "No bot token configured (set in Settings)",
    };
  }
  return checkEndpoint(
    "telegram",
    "Telegram Bot API",
    `https://api.telegram.org/bot${botToken}/getMe`
  );
}

async function checkAI(apiBase: string, apiKey: string): Promise<DependencyCheck> {
  if (!apiBase || !apiKey) {
    return {
      name: "ai",
      label: "AI Model API",
      status: "down",
      latencyMs: 0,
      lastCheck: Date.now(),
      error: "No API key configured (set in Settings)",
    };
  }
  return checkEndpoint("ai", "AI Model API", `${apiBase}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export function useStatus() {
  return useQuery<StatusCheckResult>({
    queryKey: ["status-check"],
    queryFn: async () => {
      // Read settings from localStorage
      let botToken = "";
      let aiBase = "";
      let aiKey = "";
      try {
        const raw = localStorage.getItem("liquidai:settings");
        if (raw) {
          const s = JSON.parse(raw);
          botToken = s.telegramBotToken ?? "";
          aiBase = s.aiApiBase ?? "";
          aiKey = s.aiApiKey ?? "";
        }
      } catch {
        // ignore
      }

      const [rpc, subgraph, coingecko, telegram, ai] = await Promise.all([
        checkRpc(),
        checkEndpoint(
          "subgraph",
          "Uniswap V3 Subgraph",
          CHAINS.sepolia.defaultSubgraphUrl,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "{ _meta { block { number } } }" }),
          }
        ),
        checkEndpoint(
          "coingecko",
          "CoinGecko API",
          "https://api.coingecko.com/api/v3/ping"
        ),
        checkTelegram(botToken),
        checkAI(aiBase, aiKey),
      ]);

      return {
        dependencies: [rpc, subgraph, coingecko, telegram, ai],
        ts: Date.now(),
      };
    },
    staleTime: 25_000,
    refetchInterval: 30_000,
  });
}
