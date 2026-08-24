// src/components/dashboard/StatCard.tsx — SaaSable KPI card (v1.9)
"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface Props {
  label: string;
  value: number;
  format: (n: number) => string;
  accent?: "brand" | "green" | "blue" | "ink";
  sub?: string;
  delta?: { value: string; up: boolean };
}

export function StatCard({
  label,
  value,
  format,
  accent = "ink",
  sub,
  delta,
}: Props) {
  const color =
    accent === "green"
      ? "text-[#1F8A4C]"
      : accent === "blue"
      ? "text-brand-500"
      : accent === "brand"
      ? "text-brand-600"
      : "text-ink";
  return (
    <Card>
      <CardBody className="space-y-1">
        <div className="kpi-label">{label}</div>
        <div className={`kpi-value ${color}`}>
          <AnimatedNumber value={value} format={format} />
        </div>
        <div className="flex items-center gap-2">
          {delta && (
            <span className={`kpi-delta ${delta.up ? "up" : "down"}`}>
              {delta.up ? "▲" : "▼"} {delta.value}
            </span>
          )}
          {sub && <span className="text-xs text-ink-muted">{sub}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
