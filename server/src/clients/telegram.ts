// server/src/clients/telegram.ts
// v1.3: TelegramClient wrapping the Bot API sendMessage with MarkdownV2.
// Fire-and-forget by design — callers use `sendAlert()` which never throws.

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Escape a string for Telegram MarkdownV2.
 * Characters that must be escaped: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

/**
 * Escape only the "inline" special characters (for use inside bold/code
 * spans where structural chars like [] are already consumed by the formatter).
 */
export function escapeMdInline(text: string): string {
  return text.replace(/([_*\\`\[])/g, "\\$1");
}

export interface TelegramMessageResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

export class TelegramClient {
  private readonly token: string;
  private readonly enabled: boolean;

  constructor(token?: string) {
    this.token = token ?? process.env.TELEGRAM_BOT_TOKEN ?? "";
    this.enabled = !!this.token;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Send a MarkdownV2-formatted message. Returns { ok, messageId? }.
   * Throws on network / API errors so callers can catch + log.
   */
  async sendMessage(
    chatId: string,
    markdownV2Text: string
  ): Promise<TelegramMessageResult> {
    if (!this.enabled) {
      return { ok: false, error: "TELEGRAM_BOT_TOKEN not configured" };
    }

    const url = `${TELEGRAM_API}/bot${this.token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: markdownV2Text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };

    if (!body.ok) {
      return { ok: false, error: body.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, messageId: body.result?.message_id };
  }

  /**
   * Fire-and-forget send. Catches all errors and returns a result.
   * NEVER throws — safe to call without await in a worker tick.
   */
  async sendAlert(
    chatId: string,
    markdownV2Text: string
  ): Promise<TelegramMessageResult> {
    try {
      return await this.sendMessage(chatId, markdownV2Text);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "unknown telegram error",
      };
    }
  }
}

/** Lazy singleton — only created when first accessed. */
let _client: TelegramClient | null = null;

export function getTelegramClient(): TelegramClient {
  if (!_client) {
    _client = new TelegramClient();
  }
  return _client;
}

// ---- Message formatting helpers (tested) ----

export interface AlertContext {
  actionType: string;
  status: string;
  pair: string;
  tokenId: string | number;
  reason?: string;
  dryRun?: boolean;
}

/**
 * Format a strategy-action alert as MarkdownV2.
 * All user-supplied text is escaped.
 */
export function formatActionAlert(ctx: AlertContext): string {
  const e = escapeMarkdownV2;
  const statusIcon =
    ctx.status === "EXECUTED"
      ? "✅"
      : ctx.status === "FAILED"
        ? "❌"
        : ctx.status === "DRY_RUN"
          ? "🧪"
          : "⏭";

  const lines: string[] = [];
  lines.push(`${statusIcon} *LiquidAI* \\| ${e(ctx.actionType)} ${e(ctx.status)}`);
  lines.push("");
  lines.push(`Pair: ${e(ctx.pair)}`);
  lines.push(`Position \\#${e(String(ctx.tokenId))}`);
  if (ctx.reason) {
    lines.push(`Reason: ${e(ctx.reason)}`);
  }
  if (ctx.dryRun) {
    lines.push("");
    lines.push("_Dry run mode \\- no transaction sent_");
  }
  return lines.join("\n");
}

/**
 * Format an out-of-range alert.
 */
export function formatOutOfRangeAlert(
  pair: string,
  tokenId: string | number,
  hoursOutOfRange: number
): string {
  const e = escapeMarkdownV2;
  return [
    "⚠️ *LiquidAI* \\| Position Out of Range",
    "",
    `Pair: ${e(pair)}`,
    `Position \\#${e(String(tokenId))}`,
    `Out of range for ${e(hoursOutOfRange.toFixed(1))} hours`,
  ].join("\n");
}

/**
 * Format a test message for the "Send test message" button.
 */
export function formatTestMessage(): string {
  return [
    "✅ *LiquidAI* \\| Test Message",
    "",
    "Your Telegram alerts are configured correctly\\.",
    "",
    "_You will receive notifications for strategy actions_",
  ].join("\n");
}
