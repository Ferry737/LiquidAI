// src/app/api/pools/[id]/route.ts
// Single pool detail by DeFiLlama pool ID.

import { NextResponse } from "next/server";
import { getAllPools } from "@/lib/defillama-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = decodeURIComponent(params.id);

  try {
    const { pools, fetchedAt } = await getAllPools();
    const pool = pools.find(
      (p) => p.id === id || p.id.toLowerCase() === id.toLowerCase()
    );
    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }
    return NextResponse.json({ ...pool, fetchedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "Failed to fetch pool data", detail: message },
      { status: 502 }
    );
  }
}
