// shared/types.ts
// Single source of truth for API contracts shared by /server, /worker, and the
// Next.js app.

export interface PoolToken {
  id: string;
  symbol: string;
  decimals: string;
}

export interface RankedPool {
  id: string;
  pair: string;
  token0: PoolToken;
  token1: PoolToken;
  feeTier: number;
  tvlUSD: number;
  volume24hUSD: number;
  fees24hUSD: number;
  /** Fee APR computed from 24h fees vs TVL, percent. */
  feeApr: number;
  /** DefiLlama base APY (fees), percent, when a matching yields pool exists. */
  apyBase: number | null;
  /** DefiLlama reward APY, percent. */
  apyReward: number | null;
  /** True when DefiLlama apyBase and computed feeApr agree within 15%. */
  verifiedApy: boolean;
  sparkline: number[];
}

export interface PoolDayPoint {
  /** Unix seconds (subgraph day bucket). */
  date: number;
  volumeUSD: number;
  feesUSD: number;
  tvlUSD: number;
}

export interface PoolDetail extends RankedPool {
  history7d: PoolDayPoint[];
}

export interface ProtocolStats {
  /** Uniswap v3 TVL across chains (DefiLlama). */
  protocolTvlUSD: number;
  /** Ethereum chain TVL (DefiLlama). */
  chainTvlUSD: number;
  /** Uniswap 24h DEX volume (DefiLlama). */
  volume24hUSD: number;
  updatedAt: number;
}

export interface ApiPosition {
  tokenId: string;
  pair: string;
  feeTier: number;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  liquidity: string;
  /** Estimated from the position's share of pool liquidity. */
  valueUSD: number;
  /** Estimate: 24h pool fees x share x days since mint (capped at 7d). */
  unclaimedFeesUSD: number;
  fees24hUSD: number;
  inRange: boolean;
  feeApr: number;
  /** IL estimate vs range midpoint, percent (negative = loss). */
  ilPct: number;
  /** Unix ms of the mint transaction. */
  createdAt: number;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  ts: number;
}

// ---- v1.2: Strategy configuration ----

export interface StrategyConfigDto {
  positionId: string;
  enabled: boolean;
  rebalanceAfterHrs: number;
  compoundMinUsd: number;
  maxSlippagePct: number;
  stopLossIlPct: number | null;
  updatedAt: number;
}

// ---- v1.2: Strategy action log ----

export type StrategyActionType = "REBALANCE" | "COMPOUND" | "STOP_LOSS" | "SKIPPED";
export type StrategyActionStatus = "EXECUTED" | "FAILED" | "DRY_RUN";

export interface StrategyActionDto {
  id: string;
  positionId: string;
  ts: number;
  type: StrategyActionType;
  status: StrategyActionStatus;
  txHash: string | null;
  detailsJson: string;
}

export interface PaginatedActions {
  actions: StrategyActionDto[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---- v1.2: Position snapshot (history) ----

export interface PositionSnapshotDto {
  id: string;
  positionId: string;
  ts: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  unclaimedFeesUsd: number;
  valueUsd: number;
  inRange: boolean;
  ilPct: number;
}

export interface PositionHistoryDto {
  snapshots: PositionSnapshotDto[];
  positionId: string;
}

// ---- v1.2: Analytics from DB history ----

export interface AnalyticsSummaryDto {
  totalValueUsd: number;
  totalFeesUsd: number;
  avgFeeApr: number;
  avgIlPct: number;
  inRangeCount: number;
  totalPositions: number;
  snapshotCount: number;
}

export interface AnalyticsPointDto {
  ts: number;
  totalValueUsd: number;
  totalFeesUsd: number;
  avgIlPct: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummaryDto;
  series: AnalyticsPointDto[];
}

// ---- v1.3: Server-Sent Events ----

export type SseEventType =
  | "price_update"
  | "position_status"
  | "strategy_action"
  | "engine_status";

export interface PriceUpdateEvent {
  poolId: string;
  price: number;
  ts: number;
}

export interface PositionStatusEvent {
  positionId: string;
  inRange: boolean;
  valueUsd: number;
  unclaimedFeesUsd: number;
}

export interface EngineStatusEvent {
  running: boolean;
  dryRun: boolean;
  lastRunTs: number;
}

/** Discriminated union for all SSE event payloads. */
export type SseEventData =
  | { type: "price_update"; data: PriceUpdateEvent }
  | { type: "position_status"; data: PositionStatusEvent }
  | { type: "strategy_action"; data: StrategyActionDto }
  | { type: "engine_status"; data: EngineStatusEvent };

/** Wire format for a single SSE frame (id, event type, JSON data). */
export interface SseEvent {
  id: string;
  event: SseEventType;
  data: PriceUpdateEvent | PositionStatusEvent | StrategyActionDto | EngineStatusEvent;
  ts: number;
}

// ---- v1.3: Notification settings ----

export interface NotificationSettingDto {
  owner: string;
  telegramChatId: string | null;
  enabled: boolean;
  onRebalance: boolean;
  onCompound: boolean;
  onStopLoss: boolean;
  onFailure: boolean;
  onOutOfRangeHrs: number | null;
  updatedAt: number;
}

// ---- v1.3: Engine state ----

export interface EngineStateDto {
  running: boolean;
  dryRun: boolean;
  updatedAt: number;
}
