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

const axis = { fill: "#777680", fontSize: 11 };

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
    <div className="rounded-lg border border-ink/10 bg-surface-raised/90 px-3 py-2 text-xs backdrop-blur-xl">
      <div className="text-ink-muted">{label}</div>
      <div className="tabular-nums text-ink">
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Net PnL (30d)"
          value={latest.pnl}
          format={(n) => formatUSD(n)}
          accent="green"
        />
        <StatCard
          label="Avg fee APR"
          value={avgApr}
          format={(n) => formatPct(n)}
          accent="blue"
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
                    <stop offset="0%" stopColor="#606BDF" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#606BDF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(27,27,31,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip suffix=" USD" />} />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke="#606BDF"
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
                  <CartesianGrid stroke="rgba(27,27,31,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Line
                    type="monotone"
                    dataKey="feeApr"
                    stroke="#606BDF"
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
                      <stop offset="0%" stopColor="#B26A00" stopOpacity={0} />
                      <stop offset="100%" stopColor="#B26A00" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(27,27,31,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Area
                    type="monotone"
                    dataKey="il"
                    stroke="#B26A00"
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
