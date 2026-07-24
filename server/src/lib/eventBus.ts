// server/src/lib/eventBus.ts
// v1.3: In-process pub/sub EventBus for streaming events to SSE clients.
// Singleton — all subscribers share one instance.
//
// The worker writes to DB; the server's StreamPoller reads recent rows and
// publishes events here. When the worker runs in-process it can also publish
// directly. SSE connections subscribe to receive real-time pushes.

import type { SseEventData, SseEventType } from "../../../shared/types";

export type EventHandler = (payload: SseEventData) => void;

interface Subscription {
  id: number;
  handler: EventHandler;
  /** Optional: only receive events of these types. */
  types?: Set<SseEventType>;
}

class EventBusImpl {
  private subs = new Map<number, Subscription>();
  private nextId = 0;
  private seq = 0;

  /** Publish an event to all matching subscribers. */
  publish(payload: SseEventData): void {
    this.subs.forEach((sub) => {
      if (sub.types && !sub.types.has(payload.type)) return;
      try {
        sub.handler(payload);
      } catch {
        // subscriber errors must never block the publisher
      }
    });
  }

  /**
   * Subscribe to events. Pass `types` to filter.
   * Returns an unsubscribe function.
   */
  subscribe(handler: EventHandler, types?: SseEventType[]): () => void {
    const id = this.nextId++;
    this.subs.set(id, {
      id,
      handler,
      types: types ? new Set(types) : undefined,
    });
    return () => {
      this.subs.delete(id);
    };
  }

  /** Number of active subscribers. */
  get subscriberCount(): number {
    return this.subs.size;
  }

  /** Monotonic sequence for event IDs. */
  nextSeq(): number {
    return ++this.seq;
  }

  /** Remove all subscribers (for tests). */
  clear(): void {
    this.subs.clear();
    this.seq = 0;
    this.nextId = 0;
  }
}

/** Global singleton. */
export const eventBus = new EventBusImpl();
