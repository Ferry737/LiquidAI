// server/src/lib/streamPoller.ts
// v1.3: StreamPoller — polls the DB for new snapshots and actions at intervals,
// publishing SSE events through the EventBus. This bridges the worker's
// DB writes to the SSE route's real-time push.
//
// When the worker runs as a separate process, the server polls recent DB
// rows to detect changes. When running in-process, the worker can publish
// directly to the EventBus.

import { eventBus } from "./eventBus";
import {
  getRecentActions,
  getLatestSnapshotsAll,
  isDbReady,
} from "./repo";

export class StreamPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastActionTs: Date;
  private intervalMs: number;

  constructor(intervalMs = 30_000) {
    this.intervalMs = intervalMs;
    this.lastActionTs = new Date(Date.now() - 60_000);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Poll once: check for new actions and snapshots since last poll.
   */
  async poll(): Promise<void> {
    const ready = await isDbReady();
    if (!ready) return;

    try {
      // 1. Publish new strategy actions
      const newActions = await getRecentActions(this.lastActionTs, 50);
      for (const action of newActions) {
        eventBus.publish({
          type: "strategy_action",
          data: action,
        });
        // Update watermark to the latest action's ts
        const actionTs = new Date(action.ts);
        if (actionTs > this.lastActionTs) {
          this.lastActionTs = actionTs;
        }
      }

      // 2. Publish position status updates (latest snapshot per position)
      const latestSnapshots = await getLatestSnapshotsAll();
      for (const snap of latestSnapshots) {
        eventBus.publish({
          type: "position_status",
          data: {
            positionId: snap.positionId,
            chainId: snap.chainId,
            inRange: snap.inRange,
            valueUsd: snap.valueUsd,
            unclaimedFeesUsd: snap.unclaimedFeesUsd,
          },
        });
      }
    } catch {
      // Non-fatal — polling will retry next interval
    }
  }
}

let _instance: StreamPoller | null = null;

export function getStreamPoller(): StreamPoller {
  if (!_instance) {
    _instance = new StreamPoller(30_000);
  }
  return _instance;
}
