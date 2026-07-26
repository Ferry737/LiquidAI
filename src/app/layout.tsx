// src/app/layout.tsx
import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
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
    <html lang="en" className={archivo.variable}>
      <body className="font-sans antialiased bg-surface-page text-ink">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
