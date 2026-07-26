// src/components/ui/StatusPill.tsx — SaaSable light (v1.9)
import { cn } from "@/lib/utils";

export function StatusPill({ inRange }: { inRange: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        "transition-all duration-200",
        inRange
          ? "bg-[#22892F]/10 text-[#22892F]"
          : "bg-[#B26A00]/12 text-[#B26A00]"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          inRange ? "bg-[#22892F]" : "bg-[#B26A00]"
        )}
      />
      {inRange ? "In range" : "Out of range"}
    </span>
  );
}
