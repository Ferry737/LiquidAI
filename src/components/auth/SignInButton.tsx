// src/components/auth/SignInButton.tsx
// v1.4: Post-connect SIWE prompt. Shows "Sign in" when connected but not
// authenticated, and a session pill + sign-out when authenticated.

"use client";

import { useAccount } from "wagmi";
import { Button } from "@/components/ui/Button";
import { useAuth } from "./AuthProvider";

export function SignInButton() {
  const { isConnected } = useAccount();
  const { isAuthenticated, loading, signIn, signOut } = useAuth();

  if (!isConnected) return null;

  if (isAuthenticated) {
    return (
      <Button variant="ghost" onClick={() => void signOut()} title="Sign out">
        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
        Signed in
      </Button>
    );
  }

  return (
    <Button onClick={() => void signIn()} disabled={loading}>
      {loading ? "Signing in…" : "Sign in"}
    </Button>
  );
}
