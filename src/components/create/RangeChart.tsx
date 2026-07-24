// src/components/create/RangeChart.tsx
"use client";

import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { liquidityDistribution } from "@/lib/defi-math";

interface Props {
  lower: number;
  upper: number;
  current: number;
}

export function RangeChart({ lower, upper, current }: Props) {
  const dist = liquidityDistribution(lower, upper, current);
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dist} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="price"
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            tickFormatter={(v: number) => v.toFixed(v < 10 ? 3 : 0)}
            axisLine={false}
            tickLine={false}
            interval={9}
          />
          <ReferenceLine
            x={dist.reduce((a, b) =>
              Math.abs(b.price - current) < Math.abs(a.price - current) ? b : a
            ).price}
            stroke="#22D3EE"
            strokeDasharray="3 3"
          />
          <Bar dataKey="liquidity" radius={[2, 2, 0, 0]}>
            {dist.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.price >= lower && d.price <= upper
                    ? "#34D399"
                    : "rgba(255,255,255,0.10)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
