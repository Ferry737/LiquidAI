// src/components/dashboard/StatCard.tsx
"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface Props {
  label: string;
  value: number;
  format: (n: number) => string;
  accent?: "emerald" | "cyan" | "white";
  sub?: string;
}

export function StatCard({
  label,
  value,
  format,
  accent = "white",
  sub,
}: Props) {
  const color =
    accent === "emerald"
      ? "text-emerald-300"
      : accent === "cyan"
        ? "text-cyan-300"
        : "text-white";
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-white/40">
          {label}
        </div>
        <div className={`text-2xl font-semibold ${color}`}>
          <AnimatedNumber value={value} format={format} />
        </div>
        {sub && <div className="text-xs text-white/40">{sub}</div>}
      </CardBody>
    </Card>
  );
}
