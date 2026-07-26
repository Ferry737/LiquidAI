// src/components/Sidebar.tsx — SaaSable-style left navigation (v1.9)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth/AuthProvider";
import {
  IconDashboard,
  IconPool,
  IconCreate,
  IconBacktest,
  IconAnalytics,
  IconStatus,
  IconSettings,
  IconBolt,
  IconWallet,
} from "./ui/icons";

const PRIMARY = [
  { href: "/dashboard", label: "Dashboard", Icon: IconDashboard },
  { href: "/pools", label: "Pools", Icon: IconPool },
  { href: "/create", label: "Create", Icon: IconCreate },
  { href: "/backtest", label: "Backtest", Icon: IconBacktest },
  { href: "/hft", label: "HFT Manager", Icon: IconBolt },
  { href: "/analytics", label: "Analytics", Icon: IconAnalytics },
  { href: "/status", label: "Status", Icon: IconStatus },
];

const SECONDARY = [
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { isAuthenticated } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className={cn("sidebar", open && "open")}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 shadow-[0_6px_16px_rgba(96,107,223,0.4)]">
          <IconBolt className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight text-ink">
          Liquid<span className="text-brand-500">AI</span>
        </span>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section-label">Manage</div>
        <nav className="space-y-1">
          {PRIMARY.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn("nav-item", isActive(href) && "active")}
            >
              <Icon className="nav-ico" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-section-label">Other</div>
        <nav className="space-y-1">
          {SECONDARY.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn("nav-item", isActive(href) && "active")}
            >
              <Icon className="nav-ico" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Upgrade / status card */}
        <div className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-brand-100/60 p-4">
          <div className="flex items-center gap-2 text-brand-700">
            <IconWallet className="h-4 w-4" />
            <span className="text-sm font-semibold">
              {isAuthenticated ? "Wallet linked" : "Testnet preview"}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
            {isConnected
              ? "Your SIWE session is active. Engine actions run on-chain."
              : "Connect a wallet and sign in to run the strategy engine."}
          </p>
          {!isConnected && (
            <Link
              href="/dashboard"
              onClick={onNavigate}
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Get started
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
