// src/components/pools/VerifiedApyBadge.tsx
"use client";

export function VerifiedApyBadge() {
  return (
    <span
      title="DefiLlama APY and computed fee APR agree within 15%"
      className="inline-flex items-center gap-1 rounded-md border border-[#22892F]/30 bg-[#22892F]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#22892F] shadow-card"
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
