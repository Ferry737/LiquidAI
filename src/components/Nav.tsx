// src/components/Nav.tsx
// v1.3: adds Settings link and Engine Toggle.
// v1.4: adds Backtest link, SIWE Sign-in button, and auth-gated engine toggle.
// v1.6: adds chain switcher (glass dropdown) + Status link.
// v1.8: adds Landing/Dashboard split — logo + "Dashboard" link point to the
// app, and a primary "Launch app" CTA is shown only on the landing route.
// Product controls (engine toggle, chain switcher) are hidden on the landing
// page to keep the marketing hero clean.

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

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pools", label: "Pools" },
  { href: "/create", label: "Create" },
  { href: "/backtest", label: "Backtest" },
  { href: "/analytics", label: "Analytics" },
  { href: "/status", label: "Status" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const isLanding = pathname === "/";

  const { data: engineState } = useQuery({
    queryKey: ["engine-state"],
    queryFn: fetchEngineState,
    staleTime: 30_000,
    retry: false,
    enabled: !isLanding,
  });

  const handleToggle = async (dryRun: boolean) => {
    await updateEngineState({ dryRun });
    await queryClient.invalidateQueries({ queryKey: ["engine-state"] });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-base-900/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-[0_0_22px_rgba(52,211,153,0.55)] transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-[3px] rounded-lg bg-base-900/90" />
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-emerald-300">
                ◇
              </div>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Liquid<span className="text-gradient-accent">AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => {
              const active =
                l.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-all duration-200",
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-white/50 hover:text-white/90"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!isLanding && (
            <>
              {/* v1.4: engine toggle is a mutating action — gated behind SIWE. */}
              <div
                className={cn(
                  !isAuthenticated && "pointer-events-none opacity-40"
                )}
                title={!isAuthenticated ? "Sign in to manage" : undefined}
              >
                <EngineToggle
                  engineState={engineState ?? null}
                  onToggle={handleToggle}
                />
              </div>
              <span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 sm:inline">
                Testnets
              </span>
              <ChainSwitcher />
            </>
          )}
          <SignInButton />
          <ConnectButton />
          {isLanding && (
            <Link
              href="/dashboard"
              className="hidden rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-base-900 shadow-[0_8px_32px_rgba(52,211,153,0.35)] transition-all duration-200 hover:brightness-110 md:inline-flex"
            >
              Launch app →
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
