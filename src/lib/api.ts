// src/lib/api.ts
// Typed fetch layer for the LiquidAI backend (replaces direct subgraph calls).

import type {
  ApiPosition,
  PoolDetail,
  ProtocolStats,
  RankedPool,
} from "../../shared/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export type {
  ApiPosition,
  PoolDetail,
  ProtocolStats,
  RankedPool,
} from "../../shared/types";

class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    let code = "HTTP_ERROR";
    let message = `API ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      if (body.error) message = body.error;
      if (body.code) code = body.code;
    } catch {
      // non-JSON error body — keep defaults
    }
    throw new ApiClientError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export function fetchPools(first = 25): Promise<RankedPool[]> {
  return apiGet<RankedPool[]>(`/api/pools?first=${first}`);
}

export function fetchPoolDetail(id: string): Promise<PoolDetail> {
  return apiGet<PoolDetail>(`/api/pools/${encodeURIComponent(id)}`);
}

export function fetchProtocolStats(): Promise<ProtocolStats> {
  return apiGet<ProtocolStats>(`/api/protocol/stats`);
}

export function fetchPositions(address: string): Promise<ApiPosition[]> {
  return apiGet<ApiPosition[]>(
    `/api/positions/${encodeURIComponent(address)}`
  );
}
