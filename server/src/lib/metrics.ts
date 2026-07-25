// server/src/lib/metrics.ts
// v1.6: Prometheus metrics via prom-client. Single registry, exported
// helpers used by routes, clients, worker, and SSE.

import client from "prom-client";

export const registry = new client.Registry();
registry.setDefaultLabels({ app: "liquidai" });
client.collectDefaultMetrics({ register: registry });

/** HTTP request duration histogram by route/method/status. */
export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "method", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** External API call latency by client (uniswap/defillama/telegram/llm) and chain. */
export const externalApiLatency = new client.Histogram({
  name: "external_api_latency_seconds",
  help: "External API call latency in seconds",
  labelNames: ["client", "chain"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [registry],
});

/** External API error counter by client and chain. */
export const externalApiErrors = new client.Counter({
  name: "external_api_errors_total",
  help: "External API errors",
  labelNames: ["client", "chain"] as const,
  registers: [registry],
});

/** Worker run duration by chain. */
export const workerRunDuration = new client.Histogram({
  name: "worker_run_duration_seconds",
  help: "Worker tick duration in seconds",
  labelNames: ["chain"] as const,
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  registers: [registry],
});

/** Strategy actions by type/status/chain. */
export const strategyActionsTotal = new client.Counter({
  name: "strategy_actions_total",
  help: "Strategy actions recorded",
  labelNames: ["type", "status", "chain"] as const,
  registers: [registry],
});

/** LLM tokens consumed. */
export const llmTokensTotal = new client.Counter({
  name: "llm_tokens_total",
  help: "LLM tokens consumed",
  labelNames: ["direction"] as const, // prompt | completion
  registers: [registry],
});

/** Live SSE client connections. */
export const sseClientsGauge = new client.Gauge({
  name: "sse_clients_gauge",
  help: "Connected SSE clients",
  registers: [registry],
});

/**
 * Time an external call and record latency + errors + health signal.
 * `chain` is "-" for chain-agnostic clients (defillama global, telegram, llm).
 */
export async function timeExternalCall<T>(
  clientName: "uniswap" | "defillama" | "telegram" | "llm",
  chain: string,
  fn: () => Promise<T>,
  onResult?: (ok: boolean) => void
): Promise<T> {
  const end = externalApiLatency.startTimer({ client: clientName, chain });
  try {
    const result = await fn();
    end();
    onResult?.(true);
    return result;
  } catch (err) {
    end();
    externalApiErrors.inc({ client: clientName, chain });
    onResult?.(false);
    throw err;
  }
}

/** Render metrics in Prometheus exposition format. */
export function renderMetrics(): Promise<string> {
  return registry.metrics();
}

export const metricsContentType = registry.contentType;
