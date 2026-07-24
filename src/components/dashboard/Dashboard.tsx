// src/components/dashboard/Dashboard.tsx
"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { usePositions } from "@/hooks/usePositions";
import { StatCard } from "./StatCard";
import { PositionCard } from "./PositionCard";
import { StrategyPanel } from "./StrategyPanel";
import { ProtocolStatsStrip } from "./ProtocolStatsStrip";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatUSD, formatPct } from "@/lib/utils";

export function Dashboard() {
  const { isConnected } = useAccount();
  const { data, isLoading } = usePositions();

  const totalValue = data?.reduce((s, p) => s + p.valueUSD, 0) ?? 0;
  const totalFees = data?.reduce((s, p) => s + p.unclaimedFeesUSD, 0) ?? 0;
  const avgApr =
    data && data.length
      ? data.reduce((s, p) => s + p.feeApr, 0) / data.length
      : 0;
  const inRange = data?.filter((p) => p.inRange).length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-white/40">
            Your Uniswap v3 liquidity, managed by rules.
          </p>
        </div>
        <Link href="/create">
          <Button>+ New position</Button>
        </Link>
      </div>

      <ProtocolStatsStrip />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total value"
          value={totalValue}
          format={(n) => formatUSD(n)}
        />
        <StatCard
          label="Unclaimed fees"
          value={totalFees}
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
          label="In range"
          value={inRange}
          format={(n) => `${Math.round(n)}/${data?.length ?? 0}`}
          sub="positions active"
        />
      </div>

      <StrategyPanel positions={data ?? []} />

      <div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-white/40">
          Open positions
        </h2>

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((p) => (
              <PositionCard key={p.tokenId} p={p} />
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <Card hover={false}>
            <CardBody className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-cyan-400/20" />
              <div>
                <p className="font-medium">No positions yet</p>
                <p className="mt-1 text-sm text-white/40">
                  {isConnected
                    ? "Create your first concentrated liquidity position."
                    : "Connect your wallet to get started."}
                </p>
              </div>
              <Link href="/create">
                <Button variant="ghost">Create position</Button>
              </Link>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
