// server/src/routes/notifications.ts
// v1.3: Telegram notification settings routes (zod-validated).
// v1.4: mutating routes require auth + session.address === :owner.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getNotifications,
  updateNotifications,
  sendTestMessage,
} from "../services/notifications";
import { BadRequestError } from "../lib/errors";
import { assertOwnership } from "../lib/auth";

const OwnerSchema = z.object({
  owner: z.string().min(1).max(128),
});

const UpdateBodySchema = z.object({
  telegramChatId: z.string().min(1).max(128).nullable().optional(),
  enabled: z.boolean().optional(),
  onRebalance: z.boolean().optional(),
  onCompound: z.boolean().optional(),
  onStopLoss: z.boolean().optional(),
  onFailure: z.boolean().optional(),
  onOutOfRangeHrs: z.number().min(0).max(720).nullable().optional(),
});

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  // Read: auth required, own settings only (they contain a Telegram chat id).
  app.get("/api/notifications/:owner", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    const params = OwnerSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);
    assertOwnership(req.session, params.data.owner);
    return getNotifications(params.data.owner);
  });

  // v1.4: mutating — session address must match :owner (case-insensitive).
  app.put("/api/notifications/:owner", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    const params = OwnerSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);
    assertOwnership(req.session, params.data.owner);

    const body = UpdateBodySchema.safeParse(req.body);
    if (!body.success)
      throw new BadRequestError(body.error.issues[0].message);

    return updateNotifications(params.data.owner, body.data);
  });

  app.post("/api/notifications/:owner/test", {
    preHandler: [app.requireAuth],
  }, async (req) => {
    const params = OwnerSchema.safeParse(req.params);
    if (!params.success)
      throw new BadRequestError(params.error.issues[0].message);
    assertOwnership(req.session, params.data.owner);
    return sendTestMessage(params.data.owner);
  });
}
