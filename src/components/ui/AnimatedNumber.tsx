// src/components/ui/AnimatedNumber.tsx
"use client";

import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, format, className }: Props) {
  const animated = useAnimatedNumber(value);
  const text = format ? format(animated) : animated.toFixed(2);
  return (
    <span className={`tabular-nums ${className ?? ""}`}>{text}</span>
  );
}
