// src/components/Nav.tsx
// v1.3: adds Settings link and Engine Toggle.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ConnectButton } from "./ConnectButton";
import { EngineToggle } from "./dashboard/EngineToggle";
import { fetchEngineState, updateEngineState } from "@/lib/api";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/pools", label: "Pools" },
  { href: "/create", label: "Create" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

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

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-base-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
            <span className="text-lg font-semibold tracking-tight">
              Liquid<span className="text-emerald-400">AI</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
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
          <EngineToggle engineState={engineState ?? null} onToggle={handleToggle} />
          <span className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-white/50 sm:inline">
            Sepolia
          </span>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
