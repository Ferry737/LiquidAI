// src/components/pools/VerifiedApyBadge.tsx
"use client";

export function VerifiedApyBadge() {
  return (
    <span
      title="DefiLlama APY and computed fee APR agree within 15%"
      className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.35)]"
    >
      <svg
        viewBox="0 0 12 12"
        className="h-2.5 w-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2.5 6.5l2.2 2.2L9.5 3.5" />
      </svg>
      Verified APY
    </span>
  );
}
