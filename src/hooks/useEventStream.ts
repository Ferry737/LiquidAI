// src/hooks/useEventStream.ts
// v1.3: Typed SSE hook with auto-reconnect.
// Connects to GET /api/stream, parses events, and dispatches to callbacks.
// Auto-reconnects on disconnect using exponential backoff (capped at 30s).

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  SseEventType,
  PriceUpdateEvent,
  PositionStatusEvent,
  StrategyActionDto,
  EngineStatusEvent,
} from "../../shared/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export interface EventStreamState {
  connected: boolean;
  lastEventId: number;
  reconnectAttempt: number;
}

export interface UseEventStreamCallbacks {
  onPriceUpdate?: (data: PriceUpdateEvent) => void;
  onPositionStatus?: (data: PositionStatusEvent) => void;
  onStrategyAction?: (data: StrategyActionDto) => void;
  onEngineStatus?: (data: EngineStatusEvent) => void;
}

/**
 * Subscribe to the SSE stream. Pass typed callbacks for each event type.
 * Auto-reconnects with exponential backoff. Tracks Last-Event-ID for
 * replay on reconnect.
 */
export function useEventStream(
  callbacks: UseEventStreamCallbacks,
  enabled = true
): EventStreamState {
  const [state, setState] = useState<EventStreamState>({
    connected: false,
    lastEventId: 0,
    reconnectAttempt: 0,
  });

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const lastEventIdRef = useRef(0);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    const url = `${API_BASE}/api/stream`;
    const eventSource = new EventSource(url, {
      withCredentials: false,
    });

    eventSource.addEventListener("open", () => {
      attemptRef.current = 0;
      setState((s) => ({ ...s, connected: true, reconnectAttempt: 0 }));
    });

    eventSource.addEventListener("price_update", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as PriceUpdateEvent;
      lastEventIdRef.current = parseInt(e.lastEventId, 10) || lastEventIdRef.current;
      callbacksRef.current.onPriceUpdate?.(data);
      setState((s) => ({ ...s, lastEventId: lastEventIdRef.current }));
    });

    eventSource.addEventListener("position_status", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as PositionStatusEvent;
      lastEventIdRef.current = parseInt(e.lastEventId, 10) || lastEventIdRef.current;
      callbacksRef.current.onPositionStatus?.(data);
      setState((s) => ({ ...s, lastEventId: lastEventIdRef.current }));
    });

    eventSource.addEventListener("strategy_action", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as StrategyActionDto;
      lastEventIdRef.current = parseInt(e.lastEventId, 10) || lastEventIdRef.current;
      callbacksRef.current.onStrategyAction?.(data);
      setState((s) => ({ ...s, lastEventId: lastEventIdRef.current }));
    });

    eventSource.addEventListener("engine_status", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as EngineStatusEvent;
      lastEventIdRef.current = parseInt(e.lastEventId, 10) || lastEventIdRef.current;
      callbacksRef.current.onEngineStatus?.(data);
      setState((s) => ({ ...s, lastEventId: lastEventIdRef.current }));
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
      setState((s) => ({ ...s, connected: false }));

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s cap
      attemptRef.current += 1;
      const delay = Math.min(1000 * 2 ** (attemptRef.current - 1), 30_000);
      setState((s) => ({ ...s, reconnectAttempt: attemptRef.current }));

      reconnectRef.current = setTimeout(() => connect(), delay);
    });

    return () => {
      eventSource.close();
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const cleanup = connect();
    return cleanup;
  }, [enabled, connect]);

  return state;
}
