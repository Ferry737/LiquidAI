// src/components/auth/AuthProvider.tsx
// v2.1: Client-side auth context. No backend SIWE required.
// The app works fully without authentication — wallet connection alone
// unlocks all features. This context preserves the existing useAuth() API
// so components that check isAuthenticated don't break.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";

interface SessionInfo {
  address: string;
  authenticatedAt: number;
  expiresAt: number;
}

interface AuthContextValue {
  session: SessionInfo | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: false,
  isAuthenticated: false,
  signIn: async () => {},
  signOut: async () => {},
  error: null,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();

  // v2.1: Wallet connection IS authentication. No backend SIWE needed.
  // This simplifies the flow while keeping the useAuth() API compatible.
  const session: SessionInfo | null = isConnected && address
    ? {
        address,
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      }
    : null;

  const signIn = useCallback(async () => {
    // No-op: wallet connection handles authentication
  }, []);

  const signOut = useCallback(async () => {
    // Wallet disconnect is handled by wagmi's useDisconnect in the ConnectButton
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading: false,
        isAuthenticated: isConnected,
        signIn,
        signOut,
        error: null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
