// server/src/services/notifications.ts
// v1.3: Notification service — reads/updates NotificationSetting, sends test
// messages, and gates Telegram alerts based on per-event-type preferences.

import type { NotificationSettingDto } from "../../../shared/types";
import {
  getNotificationSetting,
  upsertNotificationSetting,
} from "../lib/repo";
import {
  getTelegramClient,
  formatActionAlert,
  formatOutOfRangeAlert,
  formatTestMessage,
} from "../clients/telegram";
import { NotFoundError } from "../lib/errors";

export async function getNotifications(
  owner: string
): Promise<NotificationSettingDto> {
  const existing = await getNotificationSetting(owner);
  if (!existing) {
    // Create defaults
    return upsertNotificationSetting({ owner, enabled: false });
  }
  return existing;
}

export interface UpdateNotificationsInput {
  telegramChatId?: string | null;
  enabled?: boolean;
  onRebalance?: boolean;
  onCompound?: boolean;
  onStopLoss?: boolean;
  onFailure?: boolean;
  onOutOfRangeHrs?: number | null;
}

export async function updateNotifications(
  owner: string,
  patch: UpdateNotificationsInput
): Promise<NotificationSettingDto> {
  return upsertNotificationSetting({ owner, ...patch });
}

/**
 * Send a test message to verify the Telegram bot + chat ID.
 * Returns the Telegram API result.
 */
export async function sendTestMessage(
  owner: string
): Promise<{ ok: boolean; error?: string }> {
  const setting = await getNotificationSetting(owner);
  if (!setting) {
    throw new NotFoundError(`notifications for ${owner} not found`);
  }
  if (!setting.telegramChatId) {
    return { ok: false, error: "no telegram chat ID configured" };
  }

  const client = getTelegramClient();
  const result = await client.sendAlert(
    setting.telegramChatId,
    formatTestMessage()
  );
  return { ok: result.ok, error: result.error };
}

// ---- Alert gating ----

export type AlertEvent =
  | "rebalance"
  | "compound"
  | "stopLoss"
  | "failure"
  | "outOfRange";

/**
 * Check if a notification should be sent for a given event type, based on
 * the user's settings. Also verifies that Telegram is enabled globally and
 * a chat ID is set.
 */
export function shouldNotify(
  setting: NotificationSettingDto | null,
  event: AlertEvent
): boolean {
  if (!setting || !setting.enabled || !setting.telegramChatId) return false;

  switch (event) {
    case "rebalance":
      return setting.onRebalance;
    case "compound":
      return setting.onCompound;
    case "stopLoss":
      return setting.onStopLoss;
    case "failure":
      return setting.onFailure;
    case "outOfRange":
      return setting.onOutOfRangeHrs !== null && setting.onOutOfRangeHrs > 0;
    default:
      return false;
  }
}

/**
 * Send an action alert (fire-and-forget). Never throws.
 */
export async function sendActionAlert(opts: {
  owner: string;
  event: AlertEvent;
  pair: string;
  tokenId: string | number;
  actionType: string;
  status: string;
  reason?: string;
  dryRun?: boolean;
}): Promise<void> {
  try {
    const setting = await getNotificationSetting(opts.owner);
    if (!shouldNotify(setting, opts.event)) return;

    const client = getTelegramClient();
    const msg = formatActionAlert({
      actionType: opts.actionType,
      status: opts.status,
      pair: opts.pair,
      tokenId: opts.tokenId,
      reason: opts.reason,
      dryRun: opts.dryRun,
    });
    await client.sendAlert(setting!.telegramChatId!, msg);
  } catch (err) {
    // Never block the worker on notification failures
    console.error("[notifications] alert failed:", err);
  }
}
