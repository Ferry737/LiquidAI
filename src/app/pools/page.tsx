// src/app/pools/page.tsx
import { PoolsTable } from "@/components/pools/PoolsTable";

export default function PoolsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pools</h1>
        <p className="mt-1 text-sm text-white/40">
          Top Uniswap v3 pools ranked by TVL. Click a row to open a position.
        </p>
      </div>
      <PoolsTable />
    </div>
  );
}
