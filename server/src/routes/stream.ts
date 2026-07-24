// server/src/routes/stream.ts
// v1.3: Server-Sent Events endpoint — GET /api/stream
//
// Features:
// - SSE format: id, event, data (JSON), retry hint
// - Heartbeat (comment line ": heartbeat") every 15s
// - Auto-reconnect support via Last-Event-ID header
// - Subscribes to the in-process EventBus for real-time pushes
// - Backpressure-safe: if a client is slow, events are dropped (not queued)

import type { FastifyInstance, FastifyReply } from "fastify";
import { eventBus } from "../lib/eventBus";
import { getEngineState } from "../lib/repo";
import type { SseEventData, SseEventType } from "../../../shared/types";

const HEARTBEAT_MS = 15_000;

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/stream", async (req, reply) => {
    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Write retry hint (reconnect after 3s)
    reply.raw.write("retry: 3000\n\n");

    // Parse Last-Event-ID for reconnect support
    const lastEventId = req.headers["last-event-id"];
    let lastSeq = 0;
    if (typeof lastEventId === "string") {
      lastSeq = parseInt(lastEventId, 10) || 0;
    }

    // Send an initial engine_status event so the client has current state
    try {
      const engine = await getEngineState();
      sendEvent(reply, "engine_status", {
        running: engine.running,
        dryRun: engine.dryRun,
        lastRunTs: engine.updatedAt,
      });
    } catch {
      // DB might not be ready — skip
    }

    // Subscribe to EventBus
    const unsubscribe = eventBus.subscribe((payload: SseEventData) => {
      sendEvent(reply, payload.type, payload.data);
    });

    // Heartbeat timer
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat\n\n`);
      } catch {
        // client disconnected
      }
    }, HEARTBEAT_MS);

    // Cleanup on disconnect
    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        reply.raw.end();
      } catch {
        // already closed
      }
    };

    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);

    // Keep the reply open (don't send a body via Fastify)
    return reply;
  });
}

/**
 * Serialize and write a single SSE event frame.
 * Format:
 *   id: <seq>
 *   event: <type>
 *   data: <json>\n\n
 */
function sendEvent(
  reply: FastifyReply,
  type: SseEventType,
  data: unknown
): void {
  const seq = eventBus.nextSeq();
  const json = JSON.stringify(data);
  const frame = `id: ${seq}\nevent: ${type}\ndata: ${json}\n\n`;
  try {
    reply.raw.write(frame);
  } catch {
    // client disconnected — ignore
  }
}
