// src/components/dashboard/Dashboard.tsx
// v1.3: adds live SSE updates — position pills flip in real-time,
// animated counters update from position_status events, Engine Feed panel.

"use client";

import { useState, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { usePositions } from "@/hooks/usePositions";
import { useEventStream } from "@/hooks/useEventStream";
import { StatCard } from "./StatCard";
import { PositionCard } from "./PositionCard";
import { StrategyPanel } from "./StrategyPanel";
import { ProtocolStatsStrip } from "./ProtocolStatsStrip";
import { EngineFeed } from "./EngineFeed";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { formatUSD, formatPct } from "@/lib/utils";
import type { StrategyActionDto } from "@/lib/api";

export function Dashboard() {
  const { isConnected } = useAccount();
  const { data, isLoading } = usePositions();

  // v1.3: Live status overrides from SSE position_status events
  const [liveStatus, setLiveStatus] = useState<
    Record<string, { inRange: boolean; valueUsd: number; unclaimedFeesUsd: number }>
  >({});

  // v1.3: Strategy action feed from SSE
  const [actionFeed, setActionFeed] = useState<StrategyActionDto[]>([]);

  // v1.3: SSE callbacks
  const onPositionStatus = useCallback(
    (d: { positionId: string; inRange: boolean; valueUsd: number; unclaimedFeesUsd: number }) => {
      setLiveStatus((prev) => ({
        ...prev,
        [d.positionId]: {
          inRange: d.inRange,
          valueUsd: d.valueUsd,
          unclaimedFeesUsd: d.unclaimedFeesUsd,
        },
      }));
    },
    []
  );

  const onStrategyAction = useCallback((d: StrategyActionDto) => {
    setActionFeed((prev) => [...prev, d].slice(-50));
  }, []);

  const sseState = useEventStream({ onPositionStatus, onStrategyAction });

  // Merge live SSE data with fetched positions for display
  const positions = useMemo(() => {
    if (!data) return [];
    return data.map((p) => {
      const live = liveStatus[p.tokenId];
      if (live) {
        return {
          ...p,
          inRange: live.inRange,
          valueUSD: live.valueUsd,
          unclaimedFeesUSD: live.unclaimedFeesUsd,
        };
      }
      return p;
    });
  }, [data, liveStatus]);

  const totalValue = positions.reduce((s, p) => s + p.valueUSD, 0);
  const totalFees = positions.reduce((s, p) => s + p.unclaimedFeesUSD, 0);
  const avgApr =
    positions.length > 0
      ? positions.reduce((s, p) => s + p.feeApr, 0) / positions.length
      : 0;
  const inRange = positions.filter((p) => p.inRange).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-white/40">
            Your Uniswap v3 liquidity, managed by rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          {sseState.connected && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              live
            </span>
          )}
          <Link href="/create">
            <Button>+ New position</Button>
          </Link>
        </div>
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
          format={(n) => `${Math.round(n)}/${positions.length}`}
          sub="positions active"
        />
      </div>

      <StrategyPanel positions={positions} />

      {/* v1.3: Engine Feed — live strategy action timeline */}
      <EngineFeed actions={actionFeed} />

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

        {!isLoading && positions.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {positions.map((p) => (
              <PositionCard key={p.tokenId} p={p} />
            ))}
          </div>
        )}

        {!isLoading && positions.length === 0 && (
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
