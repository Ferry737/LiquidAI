// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(v: number, compact = true): string {
  if (!isFinite(v)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact && Math.abs(v) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(v);
}

export function formatNum(v: number, digits = 2): string {
  if (!isFinite(v)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(v);
}

export function formatPct(v: number, digits = 2): string {
  if (!isFinite(v)) return "0%";
  return `${v >= 0 ? "" : ""}${v.toFixed(digits)}%`;
}

export function shortAddr(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
