// src/hooks/useHftManager.ts
// v2.1: HFT Auto-Range Manager — autonomous background monitor that checks
// every open position. If the spot price exits the tick range, it calculates
// a new centered, tighter profitable range and simulates a rebalance.
// Optimized for sub-minute reaction time.

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { usePositions } from "./usePositions";
import { fetchTokenPrices } from "@/lib/client-api";
import {
  getLocalPositions,
  updateLocalPosition,
  getHftHistory,
  addHftRecord,
  getEngineState,
  type HftRebalanceRecord,
} from "@/lib/local-storage";

export interface HftState {
  enabled: boolean;
  tightnessPct: number;
  totalRebalances: number;
  avgApr: number;
  lastCheckTs: number | null;
  monitoringCount: number;
  history: HftRebalanceRecord[];
}

/**
 * Background HFT monitor. Runs every 30 seconds (sub-minute reaction).
 * Checks all positions where hftEnabled=true; if spot price is outside the
 * range, recalculates and simulates a rebalance.
 */
export function useHftManager() {
  const { data: positions } = usePositions();
  const [state, setState] = useState<HftState>({
    enabled: false,
    tightnessPct: 3,
    totalRebalances: 0,
    avgApr: 0,
    lastCheckTs: null,
    monitoringCount: 0,
    history: [],
  });

  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const checkAndRebalance = useCallback(async () => {
    const engine = getEngineState();
    const localPositions = getLocalPositions();
    const hftPositions = localPositions.filter((p) => p.hftEnabled);

    if (hftPositions.length === 0) {
      setState((s) => ({
        ...s,
        lastCheckTs: Date.now(),
        monitoringCount: 0,
      }));
      return;
    }

    // Fetch current prices
    const coinIds = new Set<string>();
    for (const p of hftPositions) {
      const t0 = p.pair.split("/")[0]?.trim();
      if (t0 === "WETH" || t0 === "ETH") coinIds.add("ethereum");
      else if (t0 === "WBTC") coinIds.add("wrapped-bitcoin");
      else if (t0 === "UNI") coinIds.add("uniswap");
      else if (t0 === "USDC") coinIds.add("usd-coin");
      else if (t0 === "DAI") coinIds.add("dai");
    }
    const prices = await fetchTokenPrices(Array.from(coinIds));

    let rebalanceCount = 0;
    let aprSum = 0;

    for (const pos of hftPositions) {
      const t0 = pos.pair.split("/")[0]?.trim();
      let coinId = "ethereum";
      if (t0 === "WBTC") coinId = "wrapped-bitcoin";
      else if (t0 === "UNI") coinId = "uniswap";
      else if (t0 === "USDC") coinId = "usd-coin";
      else if (t0 === "DAI") coinId = "dai";

      const spotPrice = prices[coinId] ?? pos.currentPrice;

      // Check if out of range
      const inRange = spotPrice >= pos.lowerPrice && spotPrice <= pos.upperPrice;

      if (!inRange) {
        // Calculate new centered, tighter range
        const tightness = pos.hftTightnessPct / 100;
        const newLower = spotPrice * (1 - tightness);
        const newUpper = spotPrice * (1 + tightness);

        // Calculate APR achieved (based on fees earned vs position value)
        const ageDays = Math.max(
          1,
          (Date.now() - pos.createdAt) / 86_400_000
        );
        const aprAchieved = (pos.unclaimedFeesUSD / pos.valueUSD) * 365 / ageDays * 100;

        const status = engine.dryRun ? "dry_run" : "executed";

        const record: HftRebalanceRecord = {
          id: `hft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          positionId: pos.tokenId,
          pair: pos.pair,
          ts: Date.now(),
          oldLower: pos.lowerPrice,
          oldUpper: pos.upperPrice,
          newLower,
          newUpper,
          triggerPrice: spotPrice,
          aprAchieved,
          status,
        };

        addHftRecord(record);
        rebalanceCount++;
        aprSum += aprAchieved;

        // Update the position (simulated rebalance)
        updateLocalPosition(pos.tokenId, {
          lowerPrice: newLower,
          upperPrice: newUpper,
          currentPrice: spotPrice,
          entryPrice: spotPrice,
          outOfRangeSince: null,
        });
      }
    }

    const history = getHftHistory();
    setState((s) => ({
      ...s,
      lastCheckTs: Date.now(),
      monitoringCount: hftPositions.length,
      totalRebalances: s.totalRebalances + rebalanceCount,
      avgApr: rebalanceCount > 0 ? aprSum / rebalanceCount : s.avgApr,
      history: history.slice(0, 20),
    }));
  }, []);

  // Run every 30 seconds (sub-minute reaction time)
  useEffect(() => {
    // Initial check after 2s
    const initialTimer = setTimeout(() => {
      void checkAndRebalance();
    }, 2000);

    const interval = setInterval(() => {
      void checkAndRebalance();
    }, 30_000);

    // Load initial history
    const history = getHftHistory();
    setState((s) => ({ ...s, history: history.slice(0, 20) }));

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkAndRebalance]);

  const toggle = useCallback(
    (tokenId: string, enabled: boolean) => {
      updateLocalPosition(tokenId, { hftEnabled: enabled });
    },
    []
  );

  const setTightness = useCallback(
    (tokenId: string, tightnessPct: number) => {
      updateLocalPosition(tokenId, { hftTightnessPct: tightnessPct });
    },
    []
  );

  return { state, toggle, setTightness, checkAndRebalance };
}
