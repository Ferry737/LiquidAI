// src/components/chain/ChainSwitcher.tsx
// v1.6: Glass dropdown chain switcher for the header. Chain icons are
// gradient orbs per chain; the active chain gets an emerald glow ring.
// Also switches the connected wallet chain via wagmi when possible.

"use client";

import { useEffect, useRef, useState } from "react";
import { useSwitchChain } from "wagmi";
import { cn } from "@/lib/utils";
import { useChain } from "./ChainProvider";
import { ALL_CHAINS, type ChainSlug } from "../../../shared/chains";

const CHAIN_ORB: Record<ChainSlug, string> = {
  sepolia: "from-indigo-400 to-purple-500",
  "arbitrum-sepolia": "from-sky-400 to-blue-600",
  "base-sepolia": "from-blue-400 to-cyan-500",
};

function ChainIcon({ slug, active }: { slug: ChainSlug; active?: boolean }) {
  return (
    <span
      data-testid={`chain-icon-${slug}`}
      className={cn(
        "inline-block h-4 w-4 rounded-full bg-gradient-to-br",
        CHAIN_ORB[slug],
        active && "ring-2 ring-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
      )}
    />
  );
}

export function ChainSwitcher() {
  const { chain, chainInfo, setChain } = useChain();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = (slug: ChainSlug, chainId: number) => {
    setChain(slug);
    setOpen(false);
    // Best-effort wallet switch — ignore if no wallet connected.
    try {
      switchChain({ chainId: chainId as 11155111 | 421614 | 84532 });
    } catch {
      // no connected wallet — UI-only switch
    }
  };

  return (
    <div className="relative" ref={ref} data-testid="chain-switcher">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5",
          "text-sm text-white/80 backdrop-blur-xl transition-all duration-200",
          "hover:border-white/20 hover:bg-white/[0.08]"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ChainIcon slug={chain} active />
        <span className="hidden sm:inline">{chainInfo.name}</span>
        <svg
          className={cn("h-3 w-3 text-white/40 transition-transform", open && "rotate-180")}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl",
            "border border-white/10 bg-base-900/90 shadow-2xl shadow-black/50 backdrop-blur-2xl"
          )}
        >
          {ALL_CHAINS.map((c) => {
            const active = c.slug === chain;
            return (
              <button
                key={c.slug}
                type="button"
                role="option"
                aria-selected={active}
                data-testid={`chain-option-${c.slug}`}
                onClick={() => handleSelect(c.slug, c.chainId)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors",
                  active
                    ? "bg-emerald-400/10 text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <ChainIcon slug={c.slug} active={active} />
                <span className="flex-1">{c.name}</span>
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
