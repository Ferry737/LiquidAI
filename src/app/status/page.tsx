// src/app/status/page.tsx
import type { Metadata } from "next";
import { StatusPage } from "@/components/status/StatusPage";

export const metadata: Metadata = {
  title: "Status · LiquidAI",
  description: "Per-chain engine health and dependency status",
};

export default function Status() {
  return <StatusPage />;
}
