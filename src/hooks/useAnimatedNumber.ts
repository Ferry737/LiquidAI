// src/hooks/useAnimatedNumber.ts
"use client";

import { useEffect, useRef, useState } from "react";

// Smoothly tween a displayed number toward its target — animated counters.
export function useAnimatedNumber(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    fromRef.current = value;
    startRef.current = null;
    const from = fromRef.current;
    const delta = target - from;

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
