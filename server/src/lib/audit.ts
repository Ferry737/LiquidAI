// server/src/lib/audit.ts
// Append-only audit storage and Fastify helper. Only INSERT and SELECT queries
// exist in this module; privileged mutations fail if their audit write fails.

import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import { getDb, hasDatabase } from "./db";
import type { AuditLogDto, PaginatedAuditLog } from "../../../shared/types";

export const PRIVILEGED_AUDIT_ACTIONS = Object.freeze([
  "policy.update",
  "engine.update",
  "engine.pause",
  "engine.resume",
  "position.enable-mainnet",
  "strategy.update",
  "notification.update",
] as const);

export type PrivilegedAuditAction =
  (typeof PRIVILEGED_AUDIT_ACTIONS)[number];

export interface AuditWriteInput {
  actor?: string;
  action: PrivilegedAuditAction;
  resource: string;
  before?: unknown;
  after?: unknown;
  reqId?: string | null;
}

export interface AuditInsertRow {
  actor: string;
  action: PrivilegedAuditAction;
  resource: string;
  beforeJson: string | null;
  afterJson: string | null;
  reqId: string | null;
}

export type AuditWriter = (input: AuditWriteInput) => Promise<void>;

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/** Build an audit writer around an insert-only persistence adapter. */
export function createAuditWriter(
  insert: (row: AuditInsertRow) => Promise<unknown>
): AuditWriter {
  return async (input) => {
    if (!input.actor) throw new Error("audit actor is required");
    await insert({
      actor: input.actor,
      action: input.action,
      resource: input.resource,
      beforeJson: serialize(input.before),
      afterJson: serialize(input.after),
      reqId: input.reqId ?? null,
    });
  };
}

const databaseAuditWriter = createAuditWriter(async (row) => {
  if (!hasDatabase()) {
    throw new Error("database required for append-only audit log");
  }
  return getDb().auditLog.create({ data: row });
});

/** Compatibility entry point for non-plugin callers. Prefer app.audit in routes. */
export const writeAudit: AuditWriter = databaseAuditWriter;

export interface AuditPluginOptions {
  writer?: AuditWriter;
}

declare module "fastify" {
  interface FastifyInstance {
    audit: (request: FastifyRequest, input: AuditWriteInput) => Promise<void>;
  }
}

/** Routes declare auditing through app.audit(request, metadata). */
export const auditPlugin = fp<AuditPluginOptions>(
  async (app, options) => {
    const writer = options.writer ?? databaseAuditWriter;
    app.decorate(
      "audit",
      async (request: FastifyRequest, input: AuditWriteInput): Promise<void> => {
        const actor = input.actor ?? request.session?.address;
        if (!actor) throw new Error("authenticated audit actor is required");
        await writer({
          ...input,
          actor: actor.toLowerCase(),
          reqId: input.reqId ?? String(request.id),
        });
      }
    );
  },
  { name: "audit" }
);

export interface AuditQuery {
  action?: string;
  resource?: string;
  page: number;
  pageSize: number;
}

/** Authenticated read path. There are intentionally no update/delete exports. */
export async function readAudit(query: AuditQuery): Promise<PaginatedAuditLog> {
  const page = Math.max(1, query.page);
  const pageSize = Math.min(200, Math.max(1, query.pageSize));
  if (!hasDatabase()) {
    return { entries: [], total: 0, page, pageSize, hasMore: false };
  }
  const where: { action?: string; resource?: { contains: string } } = {};
  if (query.action) where.action = query.action;
  if (query.resource) where.resource = { contains: query.resource };
  const database = getDb();
  const [rows, total] = await Promise.all([
    database.auditLog.findMany({
      where,
      orderBy: [{ ts: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    database.auditLog.count({ where }),
  ]);
  const entries: AuditLogDto[] = rows.map((row) => ({
    id: row.id,
    ts: row.ts.getTime(),
    actor: row.actor,
    action: row.action,
    resource: row.resource,
    beforeJson: row.beforeJson,
    afterJson: row.afterJson,
    reqId: row.reqId,
  }));
  return {
    entries,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}
