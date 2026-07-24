// src/components/ui/StatusPill.tsx
import { cn } from "@/lib/utils";

export function StatusPill({ inRange }: { inRange: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        "transition-all duration-200",
        inRange
          ? "bg-emerald-400/10 text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.35)]"
          : "bg-amber-400/10 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          inRange ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
        )}
      />
      {inRange ? "In range" : "Out of range"}
    </span>
  );
}
