// src/components/Providers.tsx
// v1.4: wraps the app in AuthProvider (SIWE session context).
// v1.6: adds ChainProvider (active-chain context for multi-chain UI).

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useState, type ReactNode } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ChainProvider } from "@/components/chain/ChainProvider";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ChainProvider>{children}</ChainProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
