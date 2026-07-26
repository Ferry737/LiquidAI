// src/hooks/useEventStream.ts
// v2.1: Client-side event stream simulator. No SSE backend required.
// Generates realistic strategy signals (price updates, position status changes,
// strategy actions) at intervals to drive the live dashboard experience.

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { usePositions } from "./usePositions";
import {
  getStrategyActions,
  addStrategyAction,
  type LocalStrategyAction,
} from "@/lib/local-storage";
import { getEngineState } from "@/lib/local-storage";

export interface EventStreamState {
  connected: boolean;
  lastEventId: number;
  reconnectAttempt: number;
}

export interface UseEventStreamCallbacks {
  onPriceUpdate?: (data: { poolId: string; price: number; ts: number }) => void;
  onPositionStatus?: (data: {
    positionId: string;
    chainId: number;
    inRange: boolean;
    valueUsd: number;
    unclaimedFeesUsd: number;
  }) => void;
  onStrategyAction?: (data: LocalStrategyAction) => void;
  onEngineStatus?: (data: {
    running: boolean;
    dryRun: boolean;
    lastRunTs: number;
  }) => void;
}

/**
 * v2.1: Simulates live SSE events client-side. Generates price ticks every 5s,
 * position status updates every 15s, and strategy actions when the engine is
 * running. This replaces the backend SSE stream entirely.
 */
export function useEventStream(
  callbacks: UseEventStreamCallbacks,
  enabled = true
): EventStreamState {
  const { address } = useAccount();
  const { data: positions } = usePositions();

  const [state, setState] = useState<EventStreamState>({
    connected: true,
    lastEventId: 0,
    reconnectAttempt: 0,
  });

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const eventIdRef = useRef(0);
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // Price ticker — updates every 5 seconds with small random walk
  const startPriceTicker = useCallback(() => {
    const interval = setInterval(() => {
      eventIdRef.current++;
      const pools = ["WETH/USDC", "WETH/DAI", "USDC/DAI", "UNI/WETH"];
      const poolId = pools[Math.floor(Math.random() * pools.length)];
      const basePrices: Record<string, number> = {
        "WETH/USDC": 3180,
        "WETH/DAI": 3175,
        "USDC/DAI": 1.0,
        "UNI/WETH": 0.0023,
      };
      const base = basePrices[poolId] ?? 100;
      const variance = base * 0.002;
      const price = base + (Math.random() - 0.5) * variance;
      callbacksRef.current.onPriceUpdate?.({
        poolId,
        price,
        ts: Date.now(),
      });
      setState((s) => ({ ...s, lastEventId: eventIdRef.current }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Position status — updates every 15 seconds
  const startPositionTicker = useCallback(() => {
    const interval = setInterval(() => {
      const ps = positionsRef.current;
      if (!ps || ps.length === 0) return;
      const pos = ps[Math.floor(Math.random() * ps.length)];
      eventIdRef.current++;
      // Simulate small value changes
      const valueChange = 1 + (Math.random() - 0.5) * 0.01;
      const feeChange = 1 + Math.random() * 0.05;
      callbacksRef.current.onPositionStatus?.({
        positionId: String(pos.tokenId),
        chainId: 11155111,
        inRange: pos.inRange,
        valueUsd: pos.valueUSD * valueChange,
        unclaimedFeesUsd: pos.unclaimedFeesUSD * feeChange,
      });
      setState((s) => ({ ...s, lastEventId: eventIdRef.current }));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Strategy action generator — fires when engine is running
  const startStrategyTicker = useCallback(() => {
    const interval = setInterval(() => {
      const engine = getEngineState();
      if (!engine.running) return;

      const ps = positionsRef.current;
      if (!ps || ps.length === 0) return;

      // 30% chance of generating an action each tick
      if (Math.random() > 0.3) return;

      const pos = ps[Math.floor(Math.random() * ps.length)];
      const actionTypes: LocalStrategyAction["type"][] = [
        "REBALANCE",
        "COMPOUND",
        "STOP_LOSS",
        "SKIPPED",
      ];
      const type = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      const status: LocalStrategyAction["status"] = engine.dryRun
        ? "DRY_RUN"
        : "EXECUTED";

      eventIdRef.current++;
      const action: LocalStrategyAction = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        positionId: String(pos.tokenId),
        chainId: 11155111,
        ts: Date.now(),
        type,
        status,
        details: `${type} on ${pos.pair} (tokenId ${pos.tokenId}) — ${
          type === "REBALANCE"
            ? "range exited, recentering"
            : type === "COMPOUND"
            ? "fees compounded"
            : type === "STOP_LOSS"
            ? "IL threshold hit"
            : "within range, no action needed"
        }`,
      };
      addStrategyAction(action);
      callbacksRef.current.onStrategyAction?.(action);
      setState((s) => ({ ...s, lastEventId: eventIdRef.current }));
    }, 20000); // check every 20s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Emit initial connected state
    setState((s) => ({
      ...s,
      connected: true,
      reconnectAttempt: 0,
    }));

    // Load historical actions
    const history = getStrategyActions();
    if (history.length > 0 && callbacks.onStrategyAction) {
      // Emit the most recent ones
      history.slice(0, 10).forEach((a) => {
        callbacks.onStrategyAction!(a);
      });
    }

    const stopPrice = startPriceTicker();
    const stopPositions = startPositionTicker();
    const stopStrategy = startStrategyTicker();

    return () => {
      stopPrice();
      stopPositions();
      stopStrategy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}
