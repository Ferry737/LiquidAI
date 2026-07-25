// src/app/layout.tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { SpeedInsights } from "@vercel/speed-insights/next";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LiquidAI — Autonomous Uniswap v3 Liquidity",
  description:
    "LiquidAI auto-creates and rebalances Uniswap v3 concentrated liquidity positions with a rule-based AI strategy engine. Maximise fee yield, minimise drift.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="font-sans antialiased">
        <div className="app-aurora" aria-hidden />
        <div className="app-vignette" aria-hidden />
        <Providers>
          <Nav />
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
