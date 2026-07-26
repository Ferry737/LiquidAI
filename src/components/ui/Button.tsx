// src/components/ui/Button.tsx — SaaSable light (v1.9)
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
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
        "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50",
        variant === "primary" &&
          "bg-brand-500 text-white shadow-[0_4px_14px_rgba(96,107,223,0.32)] hover:bg-brand-600 hover:shadow-[0_6px_20px_rgba(96,107,223,0.42)]",
        variant === "ghost" &&
          "border border-ink/10 bg-white text-ink-soft hover:bg-surface-page hover:text-ink hover:border-ink/20",
        variant === "danger" &&
          "border border-negative/30 bg-negative/10 text-negative hover:bg-negative/15",
        className
      )}
      {...props}
    />
  );
}
