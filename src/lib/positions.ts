// src/lib/positions.ts
// Position + analytics domain types and a deterministic demo dataset,
// so the dashboard/analytics render richly on a fresh testnet wallet.

import { feeApr as calcFeeApr, impermanentLoss } from "./defi-math";

export interface Position {
  tokenId: number;
  pair: string;
  feeTier: number;
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  valueUSD: number;
  unclaimedFeesUSD: number;
  fees24hUSD: number;
  entryPrice: number;
  createdAt: number; // epoch ms
  outOfRangeSince: number | null; // epoch ms or null
}

export interface PositionView extends Position {
  inRange: boolean;
  feeApr: number;
  ilPct: number;
  outOfRangeHours: number;
}

export function toView(p: Position): PositionView {
  const inRange =
    p.currentPrice >= p.lowerPrice && p.currentPrice <= p.upperPrice;
  const ratio = p.entryPrice > 0 ? p.currentPrice / p.entryPrice : 1;
  return {
    ...p,
    inRange,
    feeApr: calcFeeApr(p.fees24hUSD, p.valueUSD),
    ilPct: impermanentLoss(ratio),
    outOfRangeHours: p.outOfRangeSince
      ? (Date.now() - p.outOfRangeSince) / 3_600_000
      : 0,
  };
}

const now = Date.now();

export const DEMO_POSITIONS: Position[] = [
  {
    tokenId: 10241,
    pair: "WETH / USDC",
    feeTier: 500,
    lowerPrice: 2900,
    upperPrice: 3400,
    currentPrice: 3180,
    valueUSD: 12_450,
    unclaimedFeesUSD: 42.18,
    fees24hUSD: 6.4,
    entryPrice: 3050,
    createdAt: now - 1000 * 60 * 60 * 24 * 12,
    outOfRangeSince: null,
  },
  {
    tokenId: 10388,
    pair: "WETH / DAI",
    feeTier: 3000,
    lowerPrice: 3200,
    upperPrice: 3600,
    currentPrice: 3120,
    valueUSD: 6_820,
    unclaimedFeesUSD: 11.9,
    fees24hUSD: 1.2,
    entryPrice: 3400,
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    outOfRangeSince: now - 1000 * 60 * 60 * 8,
  },
  {
    tokenId: 10502,
    pair: "USDC / DAI",
    feeTier: 100,
    lowerPrice: 0.999,
    upperPrice: 1.001,
    currentPrice: 1.0002,
    valueUSD: 22_000,
    unclaimedFeesUSD: 8.3,
    fees24hUSD: 9.1,
    entryPrice: 1.0,
    createdAt: now - 1000 * 60 * 60 * 24 * 5,
    outOfRangeSince: null,
  },
];

export interface SeriesPoint {
  date: string;
  feeApr: number;
  pnl: number;
  il: number;
}

export function analyticsSeries(days = 30): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  let pnl = 0;
  for (let i = days; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const feeAprV = 14 + 6 * Math.sin(i / 3) + (Math.random() - 0.5) * 2;
    const ilV = -(1.5 + 1.2 * Math.abs(Math.sin(i / 5)));
    pnl += feeAprV / 365 / 100 * 41_000 + ilV / days * 20;
    out.push({
      date: d.toISOString().slice(5, 10),
      feeApr: Number(feeAprV.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      il: Number(ilV.toFixed(2)),
    });
  }
  return out;
}
