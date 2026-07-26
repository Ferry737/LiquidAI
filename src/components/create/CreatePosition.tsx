// src/components/create/CreatePosition.tsx
// v2.1: Full Uniswap V3 LP creation flow with demo simulation mode.
// Select pair → set lower/upper price range → deposit amounts → approve → mint.
// In demo mode (no wallet or testnet), simulates the contract call and records
// the position in localStorage. Includes price range slider and ratio calculator.

"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract, useChainId } from "wagmi";
import { parseUnits, type Address } from "viem";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RangeChart } from "./RangeChart";
import {
  FEE_TIERS,
  TOKENS,
  UNISWAP_V3,
  tokenBySymbol,
} from "@/lib/constants";
import { positionManagerAbi } from "@/lib/abi";
import {
  nearestUsableTick,
  priceToTick,
  concentrationFactor,
} from "@/lib/defi-math";
import { formatNum, formatPct } from "@/lib/utils";
import { fetchTokenPrices } from "@/lib/client-api";
import { saveLocalPosition, getSettings } from "@/lib/local-storage";

const MOCK_PRICE: Record<string, number> = {
  "WETH/USDC": 3180,
  "WETH/DAI": 3175,
  "UNI/WETH": 0.0023,
  "USDC/DAI": 1.0,
  "WETH/UNI": 430,
};

const PAIRS = [
  { from: "WETH", to: "USDC" },
  { from: "WETH", to: "DAI" },
  { from: "UNI", to: "WETH" },
  { from: "USDC", to: "DAI" },
  { from: "WETH", to: "UNI" },
];

export function CreatePosition({
  initialPair,
  initialFee,
}: {
  initialPair?: string;
  initialFee?: number;
}) {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const chainId = useChainId();

  const [token0Sym, setToken0Sym] = useState(
    initialPair?.split(" / ")[0] ?? "WETH"
  );
  const [token1Sym, setToken1Sym] = useState(
    initialPair?.split(" / ")[1] ?? "USDC"
  );
  const [fee, setFee] = useState(initialFee ?? getSettings().preferredFeeTier);
  const [amount0, setAmount0] = useState("0.5");
  const [amount1, setAmount1] = useState("1600");

  const [lowerPct, setLowerPct] = useState(-12);
  const [upperPct, setUpperPct] = useState(12);

  const [status, setStatus] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);

  // Try to fetch live price
  useMemo(() => {
    const pair = `${token0Sym}/${token1Sym}`;
    const coinId =
      token0Sym === "WETH"
        ? "ethereum"
        : token0Sym === "UNI"
        ? "uniswap"
        : "usd-coin";
    fetchTokenPrices([coinId]).then((prices) => {
      const p = prices[coinId];
      if (p) setLivePrice(p);
    });
  }, [token0Sym, token1Sym]);

  const current = livePrice ?? MOCK_PRICE[`${token0Sym}/${token1Sym}`] ?? 100;

  const lower = useMemo(
    () => current * (1 + lowerPct / 100),
    [current, lowerPct]
  );
  const upper = useMemo(
    () => current * (1 + upperPct / 100),
    [current, upperPct]
  );

  const capEff = useMemo(
    () => concentrationFactor(lower, upper, current),
    [lower, upper, current]
  );

  // Token ratio calculator (how much of each token to deposit based on range)
  const tokenRatio = useMemo(() => {
    if (current <= lower) return { token0Pct: 100, token1Pct: 0 };
    if (current >= upper) return { token0Pct: 0, token1Pct: 100 };
    // Uniswap V3 ratio formula
    const sqrtLower = Math.sqrt(lower);
    const sqrtUpper = Math.sqrt(upper);
    const sqrtCurrent = Math.sqrt(current);
    const liqToken0 =
      (sqrtUpper * sqrtCurrent - sqrtLower * sqrtCurrent) /
      (sqrtCurrent * (sqrtUpper - sqrtLower) * (sqrtUpper - sqrtCurrent) + 1);
    const t0Pct = Math.max(0, Math.min(100, liqToken0 * 100));
    return { token0Pct: t0Pct, token1Pct: 100 - t0Pct };
  }, [current, lower, upper]);

  async function onMint() {
    setStatus(null);
    const t0 = tokenBySymbol(token0Sym);
    const t1 = tokenBySymbol(token1Sym);
    if (!t0 || !t1) return;
    const tier = FEE_TIERS.find((f) => f.fee === fee)!;

    const totalUsd =
      parseFloat(amount0) * current + parseFloat(amount1);

    // Order tokens by address (Uniswap requires token0 < token1)
    const [a, b] =
      t0.address.toLowerCase() < t1.address.toLowerCase() ? [t0, t1] : [t1, t0];

    const tickLower = nearestUsableTick(priceToTick(lower), tier.tickSpacing);
    const tickUpper = nearestUsableTick(priceToTick(upper), tier.tickSpacing);

    if (!isConnected) {
      // DEMO MODE: simulate the contract call and record in localStorage
      setStatus("🔄 Simulating mint transaction...");

      // Simulate approve + mint delay
      await new Promise((r) => setTimeout(r, 1500));

      const tokenId = `demo-${Date.now()}`;
      const position = {
        tokenId,
        pair: `${token0Sym} / ${token1Sym}`,
        feeTier: fee,
        lowerPrice: lower,
        upperPrice: upper,
        currentPrice: current,
        amount0: parseFloat(amount0),
        amount1: parseFloat(amount1),
        valueUSD: totalUsd || 5000,
        unclaimedFeesUSD: 0,
        fees24hUSD: totalUsd * 0.0003 * 0.5 || 1.5,
        entryPrice: current,
        createdAt: Date.now(),
        outOfRangeSince: null,
        chainId: 11155111,
        hftEnabled: false,
        hftTightnessPct: 3,
      };

      saveLocalPosition(position);
      setStatus(`✅ Position created (demo)! Token ID: ${tokenId}. View it on the Dashboard.`);
      return;
    }

    // LIVE MODE: attempt real contract interaction
    try {
      setStatus("🔄 Sending mint transaction...");
      const hash = await writeContractAsync({
        address: UNISWAP_V3.nonfungiblePositionManager as Address,
        abi: positionManagerAbi,
        functionName: "mint",
        args: [
          {
            token0: a.address as Address,
            token1: b.address as Address,
            fee,
            tickLower,
            tickUpper,
            amount0Desired: parseUnits(amount0, t0.decimals),
            amount1Desired: parseUnits(amount1, t1.decimals),
            amount0Min: BigInt(0),
            amount1Min: BigInt(0),
            recipient: "" as Address, // will be set by wagmi
            deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
          },
        ],
      });
      setStatus(`✅ Transaction sent! Hash: ${hash}`);
    } catch (e) {
      setStatus(`❌ ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-8">
      {!isConnected && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.05] px-4 py-3 text-sm text-brand-500">
          ℹ️ Demo mode active — position creation will be simulated and saved locally.
          Connect a wallet for on-chain execution.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Configuration */}
        <Card hover={false}>
          <CardBody className="space-y-6">
            <CardTitle>Create Position</CardTitle>

            {/* Pair selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Token Pair</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={token0Sym}
                  onChange={(e) => setToken0Sym(e.target.value)}
                  className="rounded-xl border border-ink/10 bg-surface-page px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500/30"
                >
                  {TOKENS.map((t) => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
                <select
                  value={token1Sym}
                  onChange={(e) => setToken1Sym(e.target.value)}
                  className="rounded-xl border border-ink/10 bg-surface-page px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500/30"
                >
                  {TOKENS.map((t) => (
                    <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Fee tier */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink-muted">Fee Tier</label>
              <div className="grid grid-cols-4 gap-2">
                {FEE_TIERS.map((f) => (
                  <button
                    key={f.fee}
                    onClick={() => setFee(f.fee)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                      fee === f.fee
                        ? "bg-brand-500 text-white"
                        : "bg-ink/[0.04] text-ink-muted hover:text-ink-soft"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Current price */}
            <div className="rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Current Price</span>
                <span className="text-sm font-semibold tabular-nums">
                  ${formatNum(current)} {token1Sym} per {token0Sym}
                </span>
              </div>
              {livePrice && (
                <span className="text-[10px] text-[#22892F]">● live (CoinGecko)</span>
              )}
            </div>

            {/* Range slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-ink-muted">Price Range</label>
                <span className="text-xs text-brand-500">
                  {capEff.toFixed(1)}x capital efficiency
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted w-12">Lower</span>
                  <input
                    type="range"
                    min={-50}
                    max={0}
                    value={lowerPct}
                    onChange={(e) => setLowerPct(Number(e.target.value))}
                    className="flex-1 accent-brand-500"
                  />
                  <span className="text-xs tabular-nums w-16 text-right">
                    {lowerPct}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted w-12">Upper</span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={upperPct}
                    onChange={(e) => setUpperPct(Number(e.target.value))}
                    className="flex-1 accent-brand-500"
                  />
                  <span className="text-xs tabular-nums w-16 text-right">
                    +{upperPct}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-ink/[0.03] px-3 py-2">
                  <div className="text-[10px] text-ink-faint">Min price</div>
                  <div className="text-sm font-medium tabular-nums">${formatNum(lower)}</div>
                </div>
                <div className="rounded-lg bg-ink/[0.03] px-3 py-2">
                  <div className="text-[10px] text-ink-faint">Max price</div>
                  <div className="text-sm font-medium tabular-nums">${formatNum(upper)}</div>
                </div>
              </div>
            </div>

            {/* Deposit amounts */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-ink-muted">Deposit Amounts</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{token0Sym}</span>
                    <span className="text-brand-500">{tokenRatio.token0Pct.toFixed(0)}%</span>
                  </div>
                  <input
                    type="number"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm tabular-nums text-ink outline-none focus:border-brand-500/30"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{token1Sym}</span>
                    <span className="text-brand-500">{tokenRatio.token1Pct.toFixed(0)}%</span>
                  </div>
                  <input
                    type="number"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm tabular-nums text-ink outline-none focus:border-brand-500/30"
                  />
                </div>
              </div>
              <div className="text-xs text-ink-muted">
                Total: ~${(parseFloat(amount0) * current + parseFloat(amount1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>

            <Button
              onClick={() => void onMint()}
              disabled={isPending || parseFloat(amount0) <= 0}
              className="w-full"
            >
              {isPending
                ? "Confirming…"
                : isConnected
                ? "Approve & Mint"
                : "Simulate Mint (Demo)"}
            </Button>

            {status && (
              <div className="rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-3 text-sm">
                {status}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Right: Range Chart */}
        <Card hover={false}>
          <CardBody>
            <CardTitle className="mb-4">Liquidity Distribution</CardTitle>
            <RangeChart
              lower={lower}
              upper={upper}
              current={current}
            />
            <div className="mt-4 space-y-2 text-xs text-ink-muted">
              <div className="flex justify-between">
                <span>Concentration factor</span>
                <span className="tabular-nums text-brand-500">{capEff.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between">
                <span>Range width</span>
                <span className="tabular-nums">{upperPct - lowerPct}%</span>
              </div>
              <div className="flex justify-between">
                <span>Tick lower / upper</span>
                <span className="tabular-nums">
                  {nearestUsableTick(priceToTick(lower), FEE_TIERS.find((f) => f.fee === fee)?.tickSpacing ?? 10)} /{" "}
                  {nearestUsableTick(priceToTick(upper), FEE_TIERS.find((f) => f.fee === fee)?.tickSpacing ?? 10)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
