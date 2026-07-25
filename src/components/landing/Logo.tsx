// src/components/landing/Logo.tsx
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]">
        <span className="text-xs font-bold text-base-900">◇</span>
      </span>
      <span className="text-base font-semibold tracking-tight">
        Liquid<span className="text-gradient-accent">AI</span>
      </span>
    </span>
  );
}
