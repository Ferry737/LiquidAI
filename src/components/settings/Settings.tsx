// src/components/settings/Settings.tsx
// v2.1: Fully functional settings with localStorage persistence.
// AI model API base URL/key, model name, Telegram bot token, chat ID,
// default slippage, preferred fee tier. All inputs validated on save.

"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  getSettings,
  saveSettings,
  validateSettings,
  type LocalSettings,
} from "@/lib/local-storage";
import { cn } from "@/lib/utils";
import { FEE_TIERS } from "@/lib/constants";

const TOGGLES: { key: keyof Pick<LocalSettings, "onRebalance" | "onCompound" | "onStopLoss" | "onFailure">; label: string; description: string }[] = [
  { key: "onRebalance", label: "Rebalance", description: "When the engine rebalances a position" },
  { key: "onCompound", label: "Compound", description: "When fees are auto-compounded" },
  { key: "onStopLoss", label: "Stop-Loss", description: "When a stop-loss is triggered" },
  { key: "onFailure", label: "Failures", description: "When an action fails (sim or execution)" },
];

export function Settings() {
  const [settings, setSettings] = useState<LocalSettings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  function update<K extends keyof LocalSettings>(key: K, value: LocalSettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setDirty(true);
    setErrors([]);
  }

  function handleSave() {
    if (!settings) return;
    const errs = validateSettings(settings);
    setErrors(errs);
    if (errs.length === 0) {
      saveSettings(settings);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  if (!settings) {
    return (
      <Card hover={false}>
        <CardBody>Loading settings…</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Save bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Settings</h2>
          <p className="text-sm text-ink-muted">
            Configuration is saved locally in your browser.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-[#1F8A4C]">✓ Saved</span>
          )}
          {errors.length > 0 && (
            <span className="text-sm text-negative">
              {errors.length} error{errors.length > 1 ? "s" : ""}
            </span>
          )}
          <Button onClick={handleSave} disabled={!dirty}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-negative/30 bg-negative/[0.05] px-4 py-3">
          <ul className="space-y-1 text-sm text-negative">
            {errors.map((e, i) => (
              <li key={i}>• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Model Configuration */}
      <Card hover={false}>
        <CardBody className="space-y-4">
          <CardTitle>AI Model API</CardTitle>
          <p className="text-sm text-ink-muted">
            Configure the LLM used by the strategy engine. Replace demo values with your real API credentials.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="API Base URL"
              value={settings.aiApiBase}
              onChange={(v) => update("aiApiBase", v)}
              placeholder="https://api.openai.com/v1"
            />
            <Field
              label="API Key"
              value={settings.aiApiKey}
              onChange={(v) => update("aiApiKey", v)}
              placeholder="sk-..."
              type="password"
            />
            <Field
              label="Model Name"
              value={settings.aiModel}
              onChange={(v) => update("aiModel", v)}
              placeholder="gpt-4o-mini"
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink-muted">
                Preferred Fee Tier
              </label>
              <select
                value={settings.preferredFeeTier}
                onChange={(e) => update("preferredFeeTier", Number(e.target.value))}
                className="w-full rounded-xl border border-ink/10 bg-surface-page px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500/30"
              >
                {FEE_TIERS.map((f) => (
                  <option key={f.fee} value={f.fee}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Trading Parameters */}
      <Card hover={false}>
        <CardBody className="space-y-4">
          <CardTitle>Trading Parameters</CardTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Default Slippage (%)"
              value={String(settings.defaultSlippagePct)}
              onChange={(v) => update("defaultSlippagePct", parseFloat(v) || 0)}
              placeholder="0.5"
              type="number"
            />
            <Field
              label="Out-of-range alert (hours)"
              value={settings.onOutOfRangeHrs !== null ? String(settings.onOutOfRangeHrs) : ""}
              onChange={(v) => update("onOutOfRangeHrs", v ? parseFloat(v) : null)}
              placeholder="4"
              type="number"
            />
          </div>
        </CardBody>
      </Card>

      {/* Telegram Configuration */}
      <Card hover={false}>
        <CardBody className="space-y-4">
          <CardTitle>Telegram Notifications</CardTitle>
          <div className="rounded-lg border border-cyan-400/15 bg-brand-500/[0.03] px-4 py-3 text-sm text-ink-muted">
            <span className="text-brand-500">Setup:</span> Create a bot via{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-brand-500 underline hover:text-cyan-200">
              @BotFather
            </a>
            , paste the token below, then get your chat ID from{" "}
            <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-brand-500 underline hover:text-cyan-200">
              @userinfobot
            </a>
            .
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Bot Token"
              value={settings.telegramBotToken}
              onChange={(v) => update("telegramBotToken", v)}
              placeholder="123456:ABC-DEF..."
              type="password"
            />
            <Field
              label="Chat ID"
              value={settings.telegramChatId}
              onChange={(v) => update("telegramChatId", v)}
              placeholder="123456789"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.03] px-4 py-3">
            <div>
              <div className="text-sm font-medium">Enable notifications</div>
              <div className="text-xs text-ink-muted">Master switch for all alerts</div>
            </div>
            <Toggle
              checked={settings.notificationsEnabled}
              onChange={(v) => update("notificationsEnabled", v)}
            />
          </div>
        </CardBody>
      </Card>

      {/* Alert Events */}
      <Card hover={false}>
        <CardBody className="space-y-2">
          <CardTitle>Alert Events</CardTitle>
          {TOGGLES.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between rounded-lg border border-ink/10 bg-ink/[0.03] px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-ink-muted">{t.description}</div>
              </div>
              <Toggle
                checked={settings[t.key]}
                onChange={(v) => update(t.key, v)}
              />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-500/30"
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
        checked
          ? "bg-gradient-to-r from-brand-500 to-brand-400"
          : "bg-ink/[0.06]"
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
