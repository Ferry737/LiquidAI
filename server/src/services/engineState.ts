// server/src/services/engineState.ts
// v1.3: Engine state service — read/update the singleton EngineState row.

import type { EngineStateDto } from "../../../shared/types";
import { getEngineState, updateEngineState } from "../lib/repo";
import { eventBus } from "../lib/eventBus";

export async function getEngine(): Promise<EngineStateDto> {
  return getEngineState();
}

export async function updateEngine(patch: {
  running?: boolean;
  dryRun?: boolean;
}): Promise<EngineStateDto> {
  const state = await updateEngineState(patch);

  // Publish engine_status event so SSE subscribers see the change immediately.
  eventBus.publish({
    type: "engine_status",
    data: {
      running: state.running,
      dryRun: state.dryRun,
      lastRunTs: state.updatedAt,
    },
  });

  return state;
}
