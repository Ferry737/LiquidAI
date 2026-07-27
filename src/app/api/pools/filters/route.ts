// src/app/api/pools/filters/route.ts
// Returns distinct chains and projects for filter dropdowns.
import { NextResponse } from "next/server";
import { getFilterOptions } from "@/lib/defillama-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const options = await getFilterOptions();
    return NextResponse.json(options, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "Failed to fetch filter options", detail: message },
      { status: 502 }
    );
  }
}
