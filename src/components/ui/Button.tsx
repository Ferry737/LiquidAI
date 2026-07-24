// src/components/ui/Button.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
        "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
        variant === "primary" &&
          "bg-gradient-to-r from-emerald-400 to-cyan-400 text-base-900 hover:shadow-[0_8px_32px_rgba(52,211,153,0.35)] hover:brightness-110",
        variant === "ghost" &&
          "border border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.06] hover:text-white",
        variant === "danger" &&
          "border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20",
        className
      )}
      {...props}
    />
  );
}
