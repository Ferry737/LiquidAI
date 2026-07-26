// src/components/Nav.tsx → Topbar (v1.9, SaaSable light shell)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ConnectButton } from "./ConnectButton";
import { SignInButton } from "./auth/SignInButton";
import { useAuth } from "./auth/AuthProvider";
import { EngineToggle } from "./dashboard/EngineToggle";
import { ChainSwitcher } from "./chain/ChainSwitcher";
import { fetchEngineState, updateEngineState } from "@/lib/api";
import { IconMenu, IconSearch, IconBell } from "./ui/icons";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard": { title: "Dashboard", sub: "Your Uniswap v3 liquidity, managed by rules." },
  "/pools": { title: "Pools", sub: "Browse top Uniswap v3 pools by fee yield." },
  "/create": { title: "Create position", sub: "Deploy a concentrated liquidity range." },
  "/backtest": { title: "Backtest", sub: "Compare strategy presets on historical data." },
  "/analytics": { title: "Analytics", sub: "30-day performance across all positions." },
  "/status": { title: "Status", sub: "Engine health and on-chain state." },
  "/settings": { title: "Settings", sub: "Account, notifications, and engine config." },
};

function titleFor(pathname: string) {
  if (pathname.startsWith("/create")) return TITLES["/create"];
  const match = Object.keys(TITLES).find((k) => k !== "/create" && pathname.startsWith(k));
  return match ? TITLES[match] : { title: "LiquidAI", sub: "" };
}

export function Nav({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data: engineState } = useQuery({
    queryKey: ["engine-state"],
    queryFn: fetchEngineState,
    staleTime: 30_000,
    retry: false,
  });

  const handleToggle = async (dryRun: boolean) => {
    await updateEngineState({ dryRun });
    await queryClient.invalidateQueries({ queryKey: ["engine-state"] });
  };

  const { title, sub } = titleFor(pathname);

  return (
    <header className="topbar flex items-center gap-4 px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="grid h-9 w-9 place-items-center rounded-lg border border-ink/10 bg-white text-ink-muted hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <IconMenu />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-ink sm:text-xl">
          {title}
        </h1>
        {sub && (
          <p className="hidden truncate text-xs text-ink-muted sm:block">
            {sub}
          </p>
        )}
      </div>

      <div className="relative hidden md:block">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          placeholder="Search pools…"
          className="h-9 w-56 rounded-xl border border-ink/10 bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      <button
        type="button"
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-ink/10 bg-white text-ink-muted transition-colors hover:text-ink"
        aria-label="Notifications"
      >
        <IconBell />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" />
      </button>

      <div
        className={cn(!isAuthenticated && "pointer-events-none opacity-40")}
        title={!isAuthenticated ? "Sign in to manage" : undefined}
      >
        <EngineToggle
          engineState={engineState ?? null}
          onToggle={handleToggle}
        />
      </div>

      <span className="hidden rounded-full border border-ink/10 px-3 py-1 text-xs font-medium text-ink-muted sm:inline">
        Testnets
      </span>

      <ChainSwitcher />
      <SignInButton />
      <ConnectButton />
    </header>
  );
}
