// src/components/pools/PoolsTable.tsx
// v2.2: DeFiLlama Yields integration — all 16k+ pools with composable
// filtering (chain, protocol, APY, TVL, stablecoin, IL risk, search),
// sorting, and pagination.

"use client";

import { useMemo, useState, useCallback } from "react";
import { usePools, usePoolFilters } from "@/hooks/usePools";
import type { PoolFilters } from "@/lib/defillama";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatUSD, formatPct, cn } from "@/lib/utils";

type SortField = "tvl" | "apy" | "volume" | "apy7d";

export function PoolsTable() {
  // ---- Filter state ----
  const [chain, setChain] = useState("all");
  const [project, setProject] = useState("all");
  const [stablecoin, setStablecoin] = useState<"all" | "true" | "false">("all");
  const [ilRisk, setIlRisk] = useState<"all" | "no" | "yes">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortField>("tvl");
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const [minTvl, setMinTvl] = useState("");
  const [minApy, setMinApy] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  const [debounceTimer, setDebounceTimer] =
    useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback(
    (val: string) => {
      setSearchInput(val);
      if (debounceTimer) clearTimeout(debounceTimer);
      const t = setTimeout(() => {
        setSearch(val.trim());
        setPage(1);
      }, 350);
      setDebounceTimer(t);
    },
    [debounceTimer]
  );

  // ---- Build filters object ----
  const filters: PoolFilters = useMemo(() => {
    const f: PoolFilters = {
      sort,
      order,
      page,
      pageSize,
    };
    if (chain !== "all") f.chain = chain;
    if (project !== "all") f.project = project;
    if (stablecoin !== "all") f.stablecoin = stablecoin;
    if (ilRisk !== "all") f.ilRisk = ilRisk;
    if (search) f.search = search;
    if (minTvl) f.minTvl = parseFloat(minTvl);
    if (minApy) f.minApy = parseFloat(minApy);
    return f;
  }, [chain, project, stablecoin, ilRisk, search, sort, order, page, pageSize, minTvl, minApy]);

  const { data, isLoading, isError, error, isFetching } = usePools(filters);
  const { data: filterOptions } = usePoolFilters();

  const handleSort = (field: SortField) => {
    if (sort === field) {
      setOrder(order === "desc" ? "asc" : "desc");
    } else {
      setSort(field);
      setOrder("desc");
    }
  };

  const resetFilters = () => {
    setChain("all");
    setProject("all");
    setStablecoin("all");
    setIlRisk("all");
    setSearch("");
    setSearchInput("");
    setMinTvl("");
    setMinApy("");
    setSort("tvl");
    setOrder("desc");
    setPage(1);
  };

  const activeFilterCount = [
    chain !== "all",
    project !== "all",
    stablecoin !== "all",
    ilRisk !== "all",
    !!search,
    !!minTvl,
    !!minApy,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Pools</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {data
              ? `${data.total.toLocaleString()} pools across all chains · powered by DeFiLlama Yields`
              : "Loading pools from DeFiLlama…"}
          </p>
        </div>
        {data && (
          <div className="text-xs text-ink-faint">
            Cache age: {Math.floor(data.cacheAge / 1000)}s · Page {data.page}/
            {data.totalPages}
          </div>
        )}
      </div>

      {/* ---- Filter bar ---- */}
      <Card hover={false} className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Search
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Token, protocol, or chain…"
              className="w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Chain dropdown */}
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Chain
            </label>
            <select
              value={chain}
              onChange={(e) => {
                setChain(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All chains</option>
              {filterOptions?.chains.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Protocol dropdown */}
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Protocol
            </label>
            <select
              value={project}
              onChange={(e) => {
                setProject(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All protocols</option>
              {filterOptions?.projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Stablecoin filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Stablecoin
            </label>
            <select
              value={stablecoin}
              onChange={(e) => {
                setStablecoin(e.target.value as typeof stablecoin);
                setPage(1);
              }}
              className="rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All</option>
              <option value="true">Stablecoin only</option>
              <option value="false">Non-stable</option>
            </select>
          </div>

          {/* IL Risk filter */}
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              IL Risk
            </label>
            <select
              value={ilRisk}
              onChange={(e) => {
                setIlRisk(e.target.value as typeof ilRisk);
                setPage(1);
              }}
              className="rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">All</option>
              <option value="no">No IL</option>
              <option value="yes">Has IL</option>
            </select>
          </div>

          {/* Min TVL */}
          <div className="w-[120px]">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Min TVL ($)
            </label>
            <input
              type="number"
              value={minTvl}
              onChange={(e) => {
                setMinTvl(e.target.value);
                setPage(1);
              }}
              placeholder="0"
              className="w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Min APY */}
          <div className="w-[110px]">
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Min APY (%)
            </label>
            <input
              type="number"
              value={minApy}
              onChange={(e) => {
                setMinApy(e.target.value);
                setPage(1);
              }}
              placeholder="0"
              className="w-full rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-page hover:text-ink"
            >
              Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </Card>

      {/* ---- Table ---- */}
      <Card hover={false} className="overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-12 gap-4 border-b border-ink/[0.06] px-6 py-3 text-xs uppercase tracking-wider text-ink-muted">
          <div className="col-span-3">Pool</div>
          <div className="col-span-2">Chain</div>
          <div className="col-span-2">Protocol</div>
          <SortHeader label="TVL" field="tvl" sort={sort} order={order} onSort={handleSort} className="col-span-2" />
          <SortHeader label="APY" field="apy" sort={sort} order={order} onSort={handleSort} className="col-span-1" />
          <SortHeader label="7D" field="apy7d" sort={sort} order={order} onSort={handleSort} className="col-span-1" />
          <SortHeader label="Vol 24h" field="volume" sort={sort} order={order} onSort={handleSort} className="col-span-1" />
        </div>

        {/* Error state */}
        {isError && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-negative">
              Failed to load pools
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading &&
          Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center gap-4 px-6 py-3.5"
            >
              <Skeleton className="col-span-3 h-5" />
              <Skeleton className="col-span-2 h-5" />
              <Skeleton className="col-span-2 h-5" />
              <Skeleton className="col-span-2 h-5" />
              <Skeleton className="col-span-1 h-5" />
              <Skeleton className="col-span-1 h-5" />
              <Skeleton className="col-span-1 h-5" />
            </div>
          ))}

        {/* Pool rows */}
        {!isLoading &&
          !isError &&
          data?.pools.map((p, i) => (
            <div
              key={`${p.id}-${i}`}
              className="grid grid-cols-12 items-center gap-4 border-b border-ink/[0.03] px-6 py-3.5 text-sm transition-colors duration-150 hover:bg-brand-50/30"
            >
              {/* Pool symbol */}
              <div className="col-span-3 flex items-center gap-2">
                <span className="text-ink-faint tabular-nums">
                  {(page - 1) * pageSize + i + 1}
                </span>
                <span className="font-medium text-ink">{p.pair}</span>
                {p.stablecoin && (
                  <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                    USD
                  </span>
                )}
                {p.ilRisk === "no" && !p.stablecoin && (
                  <span className="rounded-md bg-positive/10 px-1.5 py-0.5 text-[10px] font-medium text-positive">
                    No IL
                  </span>
                )}
              </div>

              {/* Chain */}
              <div className="col-span-2 truncate text-ink-soft">
                {p.chain}
              </div>

              {/* Protocol */}
              <div className="col-span-2 truncate text-ink-muted">
                {p.project}
              </div>

              {/* TVL */}
              <div className="col-span-2 text-right tabular-nums text-ink-soft">
                {formatUSD(p.tvlUsd)}
              </div>

              {/* APY */}
              <div className="col-span-1 text-right tabular-nums font-medium text-positive">
                {p.apy !== null ? formatPct(p.apy) : "—"}
              </div>

              {/* 7D APY change */}
              <div
                className={cn(
                  "col-span-1 text-right tabular-nums text-xs",
                  p.apyPct7D === null
                    ? "text-ink-faint"
                    : p.apyPct7D >= 0
                      ? "text-positive"
                      : "text-negative"
                )}
              >
                {p.apyPct7D !== null
                  ? `${p.apyPct7D >= 0 ? "+" : ""}${p.apyPct7D.toFixed(1)}%`
                  : "—"}
              </div>

              {/* Volume 24h */}
              <div className="col-span-1 text-right tabular-nums text-ink-muted">
                {p.volumeUsd1d !== null ? formatUSD(p.volumeUsd1d) : "—"}
              </div>
            </div>
          ))}

        {/* Empty state */}
        {!isLoading && !isError && data?.pools.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">No pools found</p>
            <p className="mt-1 text-xs text-ink-muted">
              Try adjusting your filters.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="mt-3 rounded-xl border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </Card>

      {/* ---- Pagination ---- */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-ink-muted">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, data.total)} of {data.total.toLocaleString()}
            {isFetching && (
              <span className="ml-2 text-brand-500">Updating…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-30 enabled:hover:bg-surface-page"
            >
              « First
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-30 enabled:hover:bg-surface-page"
            >
              ‹ Prev
            </button>
            <span className="px-2 text-xs font-medium text-ink">
              {page} / {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-30 enabled:hover:bg-surface-page"
            >
              Next ›
            </button>
            <button
              disabled={page >= data.totalPages}
              onClick={() => setPage(data.totalPages)}
              className="rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-30 enabled:hover:bg-surface-page"
            >
              Last »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sortable column header ----
function SortHeader({
  label,
  field,
  sort,
  order,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  sort: SortField;
  order: "asc" | "desc";
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sort === field;
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center justify-end gap-1 select-none",
        active && "text-ink",
        className
      )}
      onClick={() => onSort(field)}
    >
      {label}
      <span className="text-[10px]">
        {active ? (order === "desc" ? "▼" : "▲") : "↕"}
      </span>
    </div>
  );
}
