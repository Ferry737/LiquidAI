// src/lib/api.ts
// Typed fetch layer for the LiquidAI backend.

import type {
  AnalyticsResponse,
  ApiPosition,
  PaginatedActions,
  PoolDetail,
  ProtocolStats,
  RankedPool,
  StrategyConfigDto,
} from "../../shared/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export type {
  AnalyticsResponse,
  ApiPosition,
  PaginatedActions,
  PoolDetail,
  ProtocolStats,
  RankedPool,
  StrategyActionDto,
  StrategyActionStatus,
  StrategyActionType,
  StrategyConfigDto,
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

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    let code = "HTTP_ERROR";
    let message = `API ${res.status}`;
    try {
      const errBody = (await res.json()) as { error?: string; code?: string };
      if (errBody.error) message = errBody.error;
      if (errBody.code) code = errBody.code;
    } catch {
      // non-JSON error body
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

export function fetchAnalytics(hours = 168): Promise<AnalyticsResponse> {
  return apiGet<AnalyticsResponse>(`/api/analytics?hours=${hours}`);
}

// ---- v1.2 Strategy API ----

export function fetchStrategy(
  positionId: string
): Promise<StrategyConfigDto> {
  return apiGet<StrategyConfigDto>(
    `/api/positions/${encodeURIComponent(positionId)}/strategy`
  );
}

export function updateStrategy(
  positionId: string,
  patch: Partial<Omit<StrategyConfigDto, "positionId" | "updatedAt">>
): Promise<StrategyConfigDto> {
  return apiPut<StrategyConfigDto>(
    `/api/positions/${encodeURIComponent(positionId)}/strategy`,
    patch
  );
}

export function fetchActions(
  positionId: string,
  page = 1,
  pageSize = 20
): Promise<PaginatedActions> {
  return apiGet<PaginatedActions>(
    `/api/positions/${encodeURIComponent(positionId)}/actions?page=${page}&pageSize=${pageSize}`
  );
}
