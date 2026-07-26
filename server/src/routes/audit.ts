// server/src/routes/audit.ts
// v1.7: GET /api/audit — read the append-only audit log (auth, paginated,
// filterable by action/resource). There is NO write/update/delete route: the
// only writer is lib/audit.writeAudit, called internally by privileged routes.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { readAudit } from "../lib/audit";
import { BadRequestError } from "../lib/errors";
import type { PaginatedAuditLog } from "../../../shared/types";

const QuerySchema = z.object({
  action: z.string().optional(),
  resource: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(25),
});

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/audit",
    { preHandler: [app.requireAuth] },
    async (req): Promise<PaginatedAuditLog> => {
      const q = QuerySchema.safeParse(req.query);
      if (!q.success) throw new BadRequestError(q.error.issues[0].message);
      return readAudit({
        action: q.data.action,
        resource: q.data.resource,
        page: q.data.page,
        pageSize: q.data.pageSize,
      });
    }
  );
}
