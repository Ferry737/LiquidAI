// src/components/settings/Settings.tsx
// v1.3: Telegram notification settings UI.
// Chat ID input with "Send test message" button, per-event-type toggles.

"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  fetchNotifications,
  updateNotifications,
  sendTestNotification,
} from "@/lib/api";
import type { NotificationSettingDto } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ToggleConfig {
  key: keyof Pick<
    NotificationSettingDto,
    "onRebalance" | "onCompound" | "onStopLoss" | "onFailure"
  >;
  label: string;
  description: string;
}

const TOGGLES: ToggleConfig[] = [
  { key: "onRebalance", label: "Rebalance", description: "When the engine rebalances a position" },
  { key: "onCompound", label: "Compound", description: "When fees are auto-compounded" },
  { key: "onStopLoss", label: "Stop-Loss", description: "When a stop-loss is triggered" },
  { key: "onFailure", label: "Failures", description: "When an action fails (sim or execution)" },
];

export function Settings() {
  const { address } = useAccount();
  const owner = address ?? "demo";

  const [setting, setSetting] = useState<NotificationSettingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [chatIdInput, setChatIdInput] = useState("");

  useEffect(() => {
    void load();
  }, [owner]);

  async function load() {
    setLoading(true);
    try {
      const s = await fetchNotifications(owner);
      setSetting(s);
      setChatIdInput(s.telegramChatId ?? "");
    } catch {
      // API might not be available in demo mode
    } finally {
      setLoading(false);
    }
  }

  async function save(patch: Partial<NotificationSettingDto>) {
    setSaving(true);
    try {
      const updated = await updateNotifications(owner, patch);
      setSetting(updated);
    } catch {
      // demo mode — update locally
      setSetting((prev) => prev ? { ...prev, ...patch } : prev);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    // Save chat ID first if it changed
    if (chatIdInput !== (setting?.telegramChatId ?? "")) {
      await save({ telegramChatId: chatIdInput || null, enabled: true });
    }
    try {
      const result = await sendTestNotification(owner);
      setTestResult(
        result.ok
          ? "✅ Test message sent!"
          : `❌ ${result.error ?? "Failed to send"}`
      );
    } catch (e) {
      setTestResult("❌ Could not reach the API");
    }
    setTimeout(() => setTestResult(null), 5000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-white/40">
          Configure Telegram alerts for strategy actions.
        </p>
      </div>

      <Card hover={false}>
        <CardBody className="space-y-6">
          {/* Telegram Bot Setup */}
          <div className="space-y-4">
            <CardTitle>Telegram Notifications</CardTitle>

            <div className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.03] px-4 py-3 text-sm text-white/60">
              <span className="text-cyan-300">Setup:</span> Create a bot via{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                @BotFather
              </a>
              , set <code className="rounded bg-white/10 px-1 py-0.5 text-xs">TELEGRAM_BOT_TOKEN</code> in the server env,
              then get your chat ID from{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                @userinfobot
              </a>
              .
            </div>

            {/* Chat ID input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Telegram Chat ID
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/30"
                />
                <Button
                  variant="ghost"
                  onClick={() => void handleTest()}
                  disabled={loading || !chatIdInput}
                >
                  Send test message
                </Button>
              </div>
              {testResult && (
                <p className="text-sm text-white/60">{testResult}</p>
              )}
            </div>

            {/* Global enable */}
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <div className="text-sm font-medium">Enable notifications</div>
                <div className="text-xs text-white/40">
                  Master switch for all Telegram alerts
                </div>
              </div>
              <Toggle
                checked={setting?.enabled ?? false}
                onChange={(v) => void save({ enabled: v })}
                disabled={loading || saving}
              />
            </div>
          </div>

          {/* Per-event-type toggles */}
          <div className="space-y-2">
            <CardTitle>Alert Events</CardTitle>
            {TOGGLES.map((t) => (
              <div
                key={t.key}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-white/40">{t.description}</div>
                </div>
                <Toggle
                  checked={setting?.[t.key] ?? false}
                  onChange={(v) => void save({ [t.key]: v })}
                  disabled={loading || saving}
                />
              </div>
            ))}

            {/* Out-of-range threshold */}
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
              <div>
                <div className="text-sm font-medium">Out-of-range threshold</div>
                <div className="text-xs text-white/40">
                  Alert when a position is out of range longer than N hours
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={720}
                  value={setting?.onOutOfRangeHrs ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    void save({
                      onOutOfRangeHrs: v ? parseFloat(v) : null,
                    });
                  }}
                  placeholder="off"
                  className="w-20 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-center text-sm outline-none focus:border-cyan-400/30"
                />
                <span className="text-xs text-white/40">hrs</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ---- Toggle switch component ----

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
        checked
          ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
          : "bg-white/10",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}
