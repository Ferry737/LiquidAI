// src/app/create/page.tsx
import { CreatePosition } from "@/components/create/CreatePosition";

export default function CreatePage({
  searchParams,
}: {
  searchParams: { pool?: string; fee?: string };
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create position
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Concentrated liquidity on Uniswap v3 · Sepolia testnet.
        </p>
      </div>
      <CreatePosition
        initialPair={searchParams.pool}
        initialFee={searchParams.fee ? Number(searchParams.fee) : undefined}
      />
    </div>
  );
}
