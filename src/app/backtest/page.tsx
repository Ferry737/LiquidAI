// src/app/backtest/page.tsx
// v1.4: Backtest page route.

import { Backtest } from "@/components/backtest/Backtest";

export const metadata = {
  title: "Backtest — LiquidAI",
};

export default function BacktestPage() {
  return <Backtest />;
}
