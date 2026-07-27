// src/app/api/pools/route.ts
// Next.js Route Handler — server-side DeFiLlama Yields proxy.
// Fetches all pools, caches 5min, applies composable filters, returns paginated.
//
// Query params (all optional, composable):
//   chain=<name>           e.g. "Ethereum", "Arbitrum", "Base"
//   project=<slug>         e.g. "uniswap-v3", "aave-v3"  (alias: protocol)
//   minTvl=<number>        minimum TVL in USD
//   maxTvl=<number>        maximum TVL in USD
//   minApy=<number>        minimum APY (%)
//   maxApy=<number>        maximum APY (%)
//   stablecoin=true|false  filter stablecoin-only or non-stable pools
//   ilRisk=no|yes          filter by IL risk
//   search=<text>          case-insensitive match on symbol/project/chain
//   sort=tvl|apy|volume    sort field (default: tvl)
//   order=desc|asc         sort direction (default: desc)
//   page=<number>          1-indexed page (default: 1)
//   pageSize=<number>      items per page, max 100 (default: 25)

import { NextResponse } from "next/server";
import { getAllPools } from "@/lib/defillama-server";
import type { NormalizedPool, PoolsResponse } from "@/lib/defillama-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 minutes
export const maxDuration = 25;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const chain = searchParams.get("chain") || undefined;
  const project =
    searchParams.get("project") || searchParams.get("protocol") || undefined;
  const minTvl = searchParams.get("minTvl");
  const maxTvl = searchParams.get("maxTvl");
  const minApy = searchParams.get("minApy");
  const maxApy = searchParams.get("maxApy");
  const stablecoinParam = searchParams.get("stablecoin");
  const ilRiskParam = searchParams.get("ilRisk");
  const search = searchParams.get("search")?.toLowerCase().trim() || undefined;
  const sort = searchParams.get("sort") || "tvl";
  const order = searchParams.get("order") || "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10) || 25)
  );

  const minTvlNum = minTvl ? parseFloat(minTvl) : undefined;
  const maxTvlNum = maxTvl ? parseFloat(maxTvl) : undefined;
  const minApyNum = minApy ? parseFloat(minApy) : undefined;
  const maxApyNum = maxApy ? parseFloat(maxApy) : undefined;

  try {
    const { pools, fetchedAt } = await getAllPools();

    // ---- Filtering pipeline ----
    let filtered: NormalizedPool[] = pools;

    if (chain && chain !== "all" && chain !== "All") {
      filtered = filtered.filter(
        (p) => p.chain.toLowerCase() === chain.toLowerCase()
      );
    }

    if (project && project !== "all" && project !== "All") {
      filtered = filtered.filter(
        (p) => p.project.toLowerCase() === project.toLowerCase()
      );
    }

    if (minTvlNum !== undefined) {
      filtered = filtered.filter((p) => p.tvlUsd >= minTvlNum);
    }
    if (maxTvlNum !== undefined) {
      filtered = filtered.filter((p) => p.tvlUsd <= maxTvlNum);
    }

    if (minApyNum !== undefined) {
      filtered = filtered.filter((p) => {
        const apy = p.apy ?? 0;
        return apy >= minApyNum;
      });
    }
    if (maxApyNum !== undefined) {
      filtered = filtered.filter((p) => {
        const apy = p.apy ?? 0;
        return apy <= maxApyNum;
      });
    }

    if (stablecoinParam === "true") {
      filtered = filtered.filter((p) => p.stablecoin === true);
    } else if (stablecoinParam === "false") {
      filtered = filtered.filter((p) => p.stablecoin === false);
    }

    if (ilRiskParam === "no") {
      filtered = filtered.filter((p) => p.ilRisk === "no" || p.ilRisk === null);
    } else if (ilRiskParam === "yes") {
      filtered = filtered.filter((p) => p.ilRisk === "yes");
    }

    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.symbol.toLowerCase().includes(search) ||
          p.project.toLowerCase().includes(search) ||
          p.chain.toLowerCase().includes(search)
      );
    }

    // ---- Sorting ----
    const sortField = sort;
    const dir = order === "asc" ? 1 : -1;

    filtered.sort((a, b) => {
      let av: number;
      let bv: number;
      switch (sortField) {
        case "apy":
          av = a.apy ?? -1;
          bv = b.apy ?? -1;
          break;
        case "volume":
          av = a.volumeUsd1d ?? 0;
          bv = b.volumeUsd1d ?? 0;
          break;
        case "apy7d":
          av = a.apyPct7D ?? -999;
          bv = b.apyPct7D ?? -999;
          break;
        case "tvl":
        default:
          av = a.tvlUsd;
          bv = b.tvlUsd;
          break;
      }
      return (av - bv) * dir;
    });

    // ---- Pagination ----
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    const body: PoolsResponse = {
      pools: paged,
      total,
      page,
      pageSize,
      totalPages,
      cacheAge: Date.now() - fetchedAt,
      fetchedAt,
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "Failed to fetch pool data", detail: message },
      { status: 502 }
    );
  }
}
