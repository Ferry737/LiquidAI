// src/components/auth/AuthProvider.tsx
// v1.4: SIWE auth context. Tracks the backend session, prompts the wallet to
// sign a SIWE message after connect, and exposes signIn/signOut helpers.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import {
  fetchNonce,
  fetchSession,
  logout as apiLogout,
  verifySiweSignature,
  type SessionInfo,
} from "@/lib/api";

interface AuthContextValue {
  /** Current backend session (null = signed out). */
  session: SessionInfo | null;
  /** True while the initial session check or a sign-in is running. */
  loading: boolean;
  /** True when the connected wallet has a valid, matching session. */
  isAuthenticated: boolean;
  /** Trigger the SIWE flow (nonce -> signMessage -> verify). */
  signIn: () => Promise<void>;
  /** Clear the backend session cookie. */
  signOut: () => Promise<void>;
  /** Last sign-in error message, if any. */
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
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
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore an existing session cookie on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSession();
        if (!cancelled) setSession(s);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      const { nonce } = await fetchNonce();
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to LiquidAI to manage your strategies.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });
      const signature = await signMessageAsync({ message });
      const s = await verifySiweSignature(message, signature);
      setSession(s);
    } catch (e) {
      setError((e as Error).message || "Sign-in failed");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // best-effort — clear local state regardless
    }
    setSession(null);
  }, []);

  // Session is only valid for the currently connected wallet.
  const isAuthenticated =
    !!session &&
    !!address &&
    isConnected &&
    session.address.toLowerCase() === address.toLowerCase() &&
    session.expiresAt > Date.now();

  // If the wallet disconnects or switches to another address, drop the
  // (now-mismatched) session so gated UI locks again.
  useEffect(() => {
    if (session && address && session.address.toLowerCase() !== address.toLowerCase()) {
      void signOut();
    }
    if (session && !isConnected) {
      void signOut();
    }
  }, [address, isConnected, session, signOut]);

  return (
    <AuthContext.Provider
      value={{ session, loading, isAuthenticated, signIn, signOut, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}
