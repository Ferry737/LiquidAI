// src/components/create/CreatePosition.tsx
"use client";

import { useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
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

const MOCK_PRICE: Record<string, number> = {
  "WETH/USDC": 3180,
  "WETH/DAI": 3175,
  "UNI/WETH": 0.0023,
  "USDC/DAI": 1.0,
  "WETH/UNI": 430,
};

export function CreatePosition({
  initialPair,
  initialFee,
}: {
  initialPair?: string;
  initialFee?: number;
}) {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [token0Sym, setToken0Sym] = useState(
    initialPair?.split(" / ")[0] ?? "WETH"
  );
  const [token1Sym, setToken1Sym] = useState(
    initialPair?.split(" / ")[1] ?? "USDC"
  );
  const [fee, setFee] = useState(initialFee ?? 500);
  const [amount0, setAmount0] = useState("0.5");
  const [amount1, setAmount1] = useState("1600");

  const current =
    MOCK_PRICE[`${token0Sym}/${token1Sym}`] ??
    MOCK_PRICE[`${token1Sym}/${token0Sym}`] ??
    100;

  const [lowerPct, setLowerPct] = useState(-12);
  const [upperPct, setUpperPct] = useState(12);

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

  const [status, setStatus] = useState<string | null>(null);

  async function onMint() {
    setStatus(null);
    const t0 = tokenBySymbol(token0Sym);
    const t1 = tokenBySymbol(token1Sym);
    if (!t0 || !t1) return;
    const tier = FEE_TIERS.find((f) => f.fee === fee)!;

    // order tokens by address (Uniswap requires token0 < token1)
    const [a, b] =
      t0.address.toLowerCase() < t1.address.toLowerCase()
        ? [t0, t1]
        : [t1, t0];
    const [aAmt, bAmt] =
      a.address === t0.address
        ? [amount0, amount1]
        : [amount1, amount0];

    const tickLower = nearestUsableTick(priceToTick(lower), tier.tickSpacing);
    const tickUpper = nearestUsableTick(priceToTick(upper), tier.tickSpacing);

    try {
      const hash = await writeContractAsync({
        address: UNISWAP_V3.nonfungiblePositionManager as `0x${string}`,
        abi: positionManagerAbi,
        functionName: "mint",
        args: [
          {
            token0: a.address as `0x${string}`,
            token1: b.address as `0x${string}`,
            fee,
            tickLower,
            tickUpper,
            amount0Desired: parseUnits(aAmt || "0", a.decimals),
            amount1Desired: parseUnits(bAmt || "0", b.decimals),
            amount0Min: 0n,
            amount1Min: 0n,
            recipient:
              "0x0000000000000000000000000000000000000000" as `0x${string}`,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
          },
        ],
      });
      setStatus(`Mint submitted: ${hash.slice(0, 10)}…`);
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message.split("\n")[0] : "Transaction rejected"
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card hover={false} className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Price range</CardTitle>
        </CardHeader>
        <CardBody className="space-y-6">
          <RangeChart lower={lower} upper={upper} current={current} />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-3">
              <div className="text-xs text-ink-muted">Min price</div>
              <div className="tabular-nums text-lg text-ink">
                {formatNum(lower, lower < 10 ? 4 : 0)}
              </div>
            </div>
            <div className="rounded-xl border border-[#22892F]/20 bg-[#22892F]/5 p-3">
              <div className="text-xs text-ink-muted">Current</div>
              <div className="tabular-nums text-lg text-[#22892F]">
                {formatNum(current, current < 10 ? 4 : 0)}
              </div>
            </div>
            <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-3">
              <div className="text-xs text-ink-muted">Max price</div>
              <div className="tabular-nums text-lg text-ink">
                {formatNum(upper, upper < 10 ? 4 : 0)}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Lower bound</span>
                <span className="tabular-nums">{lowerPct}%</span>
              </div>
              <input
                type="range"
                min={-50}
                max={-1}
                value={lowerPct}
                onChange={(e) => setLowerPct(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Upper bound</span>
                <span className="tabular-nums">+{upperPct}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={upperPct}
                onChange={(e) => setUpperPct(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-sm">
            <span className="text-ink-muted">Capital efficiency</span>
            <span className="tabular-nums text-brand-500">
              {formatNum(capEff, 1)}× vs full range
            </span>
          </div>
        </CardBody>
      </Card>

      <Card hover={false} className="lg:col-span-2">
        <CardHeader>
          <CardTitle>New position</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Token A"
              value={token0Sym}
              onChange={setToken0Sym}
            />
            <Select
              label="Token B"
              value={token1Sym}
              onChange={setToken1Sym}
            />
          </div>

          <div>
            <div className="mb-2 text-xs text-ink-muted">Fee tier</div>
            <div className="grid grid-cols-4 gap-2">
              {FEE_TIERS.map((t) => (
                <button
                  key={t.fee}
                  onClick={() => setFee(t.fee)}
                  className={
                    "rounded-lg border px-2 py-2 text-xs tabular-nums transition-all duration-200 " +
                    (fee === t.fee
                      ? "border-emerald-400/40 bg-[#22892F]/10 text-[#22892F]"
                      : "border-ink/10 bg-ink/[0.03] text-ink-muted hover:text-ink")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Amount
            label={`Amount ${token0Sym}`}
            value={amount0}
            onChange={setAmount0}
          />
          <Amount
            label={`Amount ${token1Sym}`}
            value={amount1}
            onChange={setAmount1}
          />

          <div className="rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-xs text-ink-muted">
            Est. fee APR at this range ·{" "}
            <span className="tabular-nums text-[#22892F]">
              {formatPct(Math.max(4, capEff * 3.2))}
            </span>
          </div>

          <Button
            className="w-full"
            onClick={onMint}
            disabled={!isConnected || isPending}
          >
            {!isConnected
              ? "Connect wallet to mint"
              : isPending
                ? "Confirming…"
                : "Mint position"}
          </Button>

          {status && (
            <p className="break-words text-xs text-ink-muted">{status}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-emerald-400/40"
      >
        {TOKENS.map((t) => (
          <option key={t.symbol} value={t.symbol} className="bg-surface-raised">
            {t.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}

function Amount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs text-ink-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-right tabular-nums text-ink outline-none transition-colors focus:border-emerald-400/40"
      />
    </label>
  );
}
