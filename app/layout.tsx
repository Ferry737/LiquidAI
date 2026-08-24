import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiquidAI — Liquidity that manages itself",
  description:
    "LiquidAI automatically creates and rebalances Uniswap v3 concentrated-liquidity positions so capital stays productive without constant manual management.",
  metadataBase: new URL("https://liquid-ai-coral.vercel.app"),
  openGraph: {
    title: "LiquidAI — Liquidity that manages itself",
    description:
      "Autonomous Uniswap v3 liquidity management. Concentrated liquidity, on-chain verifiable execution, smart alerts, and backtesting.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0D0F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
