// src/components/AppShell.tsx — SaaSable light admin shell (v1.9)
// Topbar + fixed left sidebar. Landing page ("/") opts out via the
// `data-shell="false"` body attribute set by the landing route so the
// marketing hero stays full-bleed.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { Nav as Topbar } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [open, setOpen] = useState(false);

  if (isLanding) {
    // Landing keeps the standalone marketing layout.
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="page-area">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="page-main">{children}</main>
      </div>
    </div>
  );
}
