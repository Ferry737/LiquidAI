// src/lib/api.ts
// Typed fetch layer for the LiquidAI backend.
// v1.3: adds Notification + Engine API functions.
// v1.4: credentials:"include" everywhere (httpOnly session cookie) + SIWE
// auth API + backtest API.

import type {
  AnalyticsResponse,
  ApiPosition,
  PaginatedActions,
  PoolDetail,
  ProtocolStats,
  RankedPool,
  StrategyConfigDto,
  NotificationSettingDto,
  EngineStateDto,
  NonceResponse,
  SessionInfo,
  BacktestDto,
  BacktestResult,
  CreateBacktestInput,
  StatusResponse,
} from "../../shared/types";
import { DEFAULT_CHAIN_SLUG, type ChainSlug } from "../../shared/chains";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export type {
  AnalyticsResponse,
  ApiPosition,
  EngineStateDto,
  NotificationSettingDto,
  PaginatedActions,
  PoolDetail,
  ProtocolStats,
  RankedPool,
  StrategyActionDto,
  StrategyActionStatus,
  StrategyActionType,
  StrategyConfigDto,
  NonceResponse,
  SessionInfo,
  BacktestDto,
  BacktestResult,
  CreateBacktestInput,
} from "../../shared/types";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function parseError(res: Response): Promise<ApiClientError> {
  let code = "HTTP_ERROR";
  let message = `API ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string; code?: string };
    if (body.error) message = body.error;
    if (body.code) code = body.code;
  } catch {
    // non-JSON error body — keep defaults
  }
  return new ApiClientError(res.status, code, message);
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export function fetchPools(
  first = 25,
  chain: ChainSlug = DEFAULT_CHAIN_SLUG
): Promise<RankedPool[]> {
  return apiGet<RankedPool[]>(`/api/pools?first=${first}&chain=${chain}`);
}

export function fetchPoolDetail(
  id: string,
  chain: ChainSlug = DEFAULT_CHAIN_SLUG
): Promise<PoolDetail> {
  return apiGet<PoolDetail>(
    `/api/pools/${encodeURIComponent(id)}?chain=${chain}`
  );
}

export function fetchProtocolStats(): Promise<ProtocolStats> {
  return apiGet<ProtocolStats>(`/api/protocol/stats`);
}

export function fetchPositions(
  address: string,
  chain: ChainSlug = DEFAULT_CHAIN_SLUG
): Promise<ApiPosition[]> {
  return apiGet<ApiPosition[]>(
    `/api/positions/${encodeURIComponent(address)}?chain=${chain}`
  );
}

// ---- v1.6 Status API ----

export function fetchStatus(): Promise<StatusResponse> {
  return apiGet<StatusResponse>(`/api/status`);
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

// ---- v1.3 Engine API ----

export function fetchEngineState(): Promise<EngineStateDto> {
  return apiGet<EngineStateDto>(`/api/engine`);
}

export function updateEngineState(patch: {
  running?: boolean;
  dryRun?: boolean;
}): Promise<EngineStateDto> {
  return apiPut<EngineStateDto>(`/api/engine`, patch);
}

// ---- v1.3 Notifications API ----

export function fetchNotifications(
  owner: string
): Promise<NotificationSettingDto> {
  return apiGet<NotificationSettingDto>(
    `/api/notifications/${encodeURIComponent(owner)}`
  );
}

export function updateNotifications(
  owner: string,
  patch: Partial<Omit<NotificationSettingDto, "owner" | "updatedAt">>
): Promise<NotificationSettingDto> {
  return apiPut<NotificationSettingDto>(
    `/api/notifications/${encodeURIComponent(owner)}`,
    patch
  );
}

export function sendTestNotification(
  owner: string
): Promise<{ ok: boolean; error?: string }> {
  return apiPost<{ ok: boolean; error?: string }>(
    `/api/notifications/${encodeURIComponent(owner)}/test`
  );
}

// ---- v1.4 SIWE Auth API ----

export function fetchNonce(): Promise<NonceResponse> {
  return apiGet<NonceResponse>(`/api/auth/nonce`);
}

export function verifySiweSignature(
  message: string,
  signature: string
): Promise<SessionInfo> {
  return apiPost<SessionInfo>(`/api/auth/verify`, { message, signature });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/api/auth/logout`);
}

export function fetchSession(): Promise<SessionInfo | null> {
  return apiGet<SessionInfo | null>(`/api/auth/me`);
}

// ---- v1.4 Backtest API ----

export function runBacktest(input: CreateBacktestInput): Promise<BacktestDto> {
  return apiPost<BacktestDto>(`/api/backtests`, input);
}

export function fetchBacktests(): Promise<BacktestDto[]> {
  return apiGet<BacktestDto[]>(`/api/backtests`);
}

export function fetchBacktest(id: string): Promise<BacktestDto> {
  return apiGet<BacktestDto>(`/api/backtests/${encodeURIComponent(id)}`);
}

/** Parse the resultJson payload of a persisted backtest row. */
export function parseBacktestResult(dto: BacktestDto): BacktestResult {
  return JSON.parse(dto.resultJson) as BacktestResult;
}
