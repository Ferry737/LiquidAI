// src/app/sign-up/page.tsx
// Compatibility entry point for the previous email-sign-up URL.
// LiquidAI v1.5 uses wallet-native SIWE authentication instead.

import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { SignInButton } from "@/components/auth/SignInButton";

export default function SignUpPage() {
  return (
    <section className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center">
      <div className="w-full rounded-3xl border border-ink/10 bg-ink/[0.03] p-8 text-center shadow-2xl shadow-emerald-950/20 sm:p-10">
        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 shadow-card" />
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1F8A4C]/80">
          LiquidAI
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Create your LiquidAI account
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ink-muted">
          LiquidAI uses your Ethereum wallet as your account. Connect a Sepolia
          wallet, then sign in with a message — no email, password, or account
          form is required.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ConnectButton />
          <SignInButton />
        </div>
        <p className="mt-7 text-xs text-ink-muted">
          Already have access?{" "}
          <Link className="text-[#1F8A4C] hover:text-emerald-200" href="/dashboard">
            Return to the dashboard
          </Link>
        </p>
      </div>
    </section>
  );
}
