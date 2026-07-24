// src/components/analytics/Analytics.tsx
"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/dashboard/StatCard";
import { analyticsSeries } from "@/lib/positions";
import { formatUSD, formatPct } from "@/lib/utils";

const axis = { fill: "rgba(255,255,255,0.35)", fontSize: 11 };

function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-base-800/90 px-3 py-2 text-xs backdrop-blur-xl">
      <div className="text-white/40">{label}</div>
      <div className="tabular-nums text-white">
        {payload[0].value.toFixed(2)}
        {suffix}
      </div>
    </div>
  );
}

export function Analytics() {
  const data = useMemo(() => analyticsSeries(30), []);
  const latest = data[data.length - 1];
  const avgApr =
    data.reduce((s, d) => s + d.feeApr, 0) / (data.length || 1);
  const avgIl = data.reduce((s, d) => s + d.il, 0) / (data.length || 1);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-white/40">
          30-day performance across all positions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Net PnL (30d)"
          value={latest.pnl}
          format={(n) => formatUSD(n)}
          accent="emerald"
        />
        <StatCard
          label="Avg fee APR"
          value={avgApr}
          format={(n) => formatPct(n)}
          accent="cyan"
        />
        <StatCard
          label="Avg IL"
          value={avgIl}
          format={(n) => formatPct(n)}
        />
      </div>

      <Card hover={false}>
        <CardHeader>
          <CardTitle>Cumulative PnL</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip suffix=" USD" />} />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke="#34D399"
                  strokeWidth={2}
                  fill="url(#pnl)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Fee APR</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Line
                    type="monotone"
                    dataKey="feeApr"
                    stroke="#22D3EE"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card hover={false}>
          <CardHeader>
            <CardTitle>Impermanent loss</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="il" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity={0} />
                      <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Area
                    type="monotone"
                    dataKey="il"
                    stroke="#FBBF24"
                    strokeWidth={2}
                    fill="url(#il)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
