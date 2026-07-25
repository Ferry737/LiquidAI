// server/src/lib/health.ts
// v1.6: HealthService — rolling success/error counters per dependency,
// derived status ok|degraded|down. Dependencies: subgraph per chain,
// defillama, llm, telegram, db.

export type DependencyStatus = "ok" | "degraded" | "down" | "unknown";

export interface DependencySnapshot {
  name: string;
  status: DependencyStatus;
  successCount: number;
  errorCount: number;
  lastSuccessTs: number | null;
  lastErrorTs: number | null;
  lastError: string | null;
}

interface Sample {
  ts: number;
  ok: boolean;
  error?: string;
}

const WINDOW_MS = 10 * 60 * 1000; // rolling 10 minutes

/**
 * Status derivation matrix (over the rolling window):
 *   - no samples                          -> unknown
 *   - errorRate == 0                      -> ok
 *   - 0 < errorRate < 0.5                 -> degraded
 *   - errorRate >= 0.5 AND
 *       last sample is an error           -> down
 *   - errorRate >= 0.5 but last sample ok -> degraded (recovering)
 */
export function deriveStatus(
  successCount: number,
  errorCount: number,
  lastSampleOk: boolean | null
): DependencyStatus {
  const total = successCount + errorCount;
  if (total === 0) return "unknown";
  if (errorCount === 0) return "ok";
  const errorRate = errorCount / total;
  if (errorRate < 0.5) return "degraded";
  return lastSampleOk ? "degraded" : "down";
}

class HealthServiceImpl {
  private samples = new Map<string, Sample[]>();

  /** Record a success/error observation for a dependency. */
  record(dep: string, ok: boolean, error?: string): void {
    const list = this.samples.get(dep) ?? [];
    list.push({ ts: Date.now(), ok, error });
    // Keep bounded
    if (list.length > 500) list.splice(0, list.length - 500);
    this.samples.set(dep, list);
  }

  recordSuccess(dep: string): void {
    this.record(dep, true);
  }

  recordError(dep: string, error?: string): void {
    this.record(dep, false, error);
  }

  /** Snapshot of one dependency over the rolling window. */
  snapshot(dep: string): DependencySnapshot {
    const now = Date.now();
    const list = (this.samples.get(dep) ?? []).filter(
      (s) => now - s.ts <= WINDOW_MS
    );
    const successCount = list.filter((s) => s.ok).length;
    const errorCount = list.length - successCount;
    const lastSample = list.length ? list[list.length - 1] : null;
    const lastSuccess = [...list].reverse().find((s) => s.ok) ?? null;
    const lastError = [...list].reverse().find((s) => !s.ok) ?? null;

    return {
      name: dep,
      status: deriveStatus(successCount, errorCount, lastSample?.ok ?? null),
      successCount,
      errorCount,
      lastSuccessTs: lastSuccess?.ts ?? null,
      lastErrorTs: lastError?.ts ?? null,
      lastError: lastError?.error ?? null,
    };
  }

  /** Snapshot all known dependencies (plus any names passed in `ensure`). */
  snapshotAll(ensure: string[] = []): DependencySnapshot[] {
    const names = new Set<string>([...this.samples.keys(), ...ensure]);
    return [...names].sort().map((n) => this.snapshot(n));
  }

  /** Reset all samples (tests). */
  clear(): void {
    this.samples.clear();
  }
}

/** Global singleton. */
export const healthService = new HealthServiceImpl();

/** Dependency name helpers — keep naming consistent everywhere. */
export function subgraphDep(chainSlug: string): string {
  return `subgraph:${chainSlug}`;
}
export const DEP_DEFILLAMA = "defillama";
export const DEP_TELEGRAM = "telegram";
export const DEP_LLM = "llm";
export const DEP_DB = "db";
