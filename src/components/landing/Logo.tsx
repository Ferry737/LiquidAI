// src/components/landing/Logo.tsx
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-400 shadow-card">
        <span className="text-xs font-bold text-white">◇</span>
      </span>
      <span className="text-base font-semibold tracking-tight">
        Liquid<span className="text-brand-gradient">AI</span>
      </span>
    </span>
  );
}
