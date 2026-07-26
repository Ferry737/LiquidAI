// src/components/dashboard/WalletBalanceCard.tsx
// v2.1: Displays native + ERC-20 token balances fetched via wagmi/viem
// from the connected chain's public RPC. Real on-chain data.

"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatUSD } from "@/lib/utils";
import type { BalanceSummary } from "@/hooks/useBalances";
import { explorerAddressUrl } from "../../../shared/chains";
import { useChain } from "@/components/chain/ChainProvider";
import Link from "next/link";

export function WalletBalanceCard({ data }: { data: BalanceSummary }) {
  const { chain } = useChain();
  const { native, tokens, totalUsd } = data;

  const nonZeroTokens = tokens.filter(
    (t) => t.balance > BigInt(0)
  );

  return (
    <Card hover={false}>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wider text-ink-muted">
            Wallet Balances
          </h3>
          <span className="text-xs text-ink-faint">
            Live from {chain} RPC
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Native ETH */}
          <div className="rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">
                {native.symbol}
              </span>
              {native.usdValue !== null && (
                <span className="text-xs text-[#22892F]">
                  {formatUSD(native.usdValue)}
                </span>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {parseFloat(native.formatted).toFixed(4)}
            </div>
          </div>

          {/* ERC-20 tokens */}
          {nonZeroTokens.slice(0, 3).map((token) => (
            <div
              key={token.address}
              className="rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">
                  {token.symbol}
                </span>
                {token.usdValue !== null && (
                  <span className="text-xs text-[#22892F]">
                    {formatUSD(token.usdValue)}
                  </span>
                )}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {parseFloat(token.formatted).toFixed(
                  token.decimals === 6 ? 2 : 4
                )}
              </div>
            </div>
          ))}
        </div>

        {totalUsd > 0 && (
          <div className="flex items-center justify-between border-t border-ink/10 pt-3">
            <span className="text-sm text-ink-muted">Total wallet value</span>
            <span className="text-lg font-bold tabular-nums text-brand-500">
              {formatUSD(totalUsd)}
            </span>
          </div>
        )}

        {native.balance > BigInt(0) && (
          <div className="text-xs text-ink-faint">
            Verify on{" "}
            <Link
              href={explorerAddressUrl(chain, "")}
              target="_blank"
              rel="noreferrer"
              className="text-brand-500 hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              block explorer
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
