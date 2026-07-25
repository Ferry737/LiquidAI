// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "LiquidAI — Autonomous Uniswap v3 Liquidity",
  description:
    "Create and auto-manage Uniswap v3 liquidity positions on Sepolia with a rule-based AI strategy engine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
        </Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
