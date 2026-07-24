// server/src/routes/auth.ts
// v1.4: SIWE authentication routes — nonce, verify, logout, me.

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  generateNonce,
  consumeNonce,
  getSessionKey,
  verifySiwe,
  issueSession,
  clearSession,
} from "../lib/auth";
import { BadRequestError, UnauthorizedError } from "../lib/errors";
import type { NonceResponse, SessionInfo } from "../../../shared/types";

const VerifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "invalid signature hex"),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/auth/nonce — issue a per-session nonce.
  app.get("/api/auth/nonce", async (req, reply): Promise<NonceResponse> => {
    // Bind the nonce to a browser session via a pre-auth cookie so the
    // nonce -> verify round-trip is scoped to more than just the IP.
    // IMPORTANT: resolve the pre-auth id BEFORE computing the session key so
    // a freshly-issued cookie and the stored nonce key always agree.
    let preAuthId = (req.cookies as Record<string, string> | undefined)?.["liquidai_preauth"];
    if (!preAuthId) {
      preAuthId = randomUUID();
      reply.setCookie("liquidai_preauth", preAuthId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 600, // 10 min — same as nonce TTL
      });
    }

    const sessionKey = `${req.ip}:${preAuthId}`;
    const nonce = generateNonce(sessionKey);
    return { nonce };
  });

  // POST /api/auth/verify — verify SIWE message + signature, issue JWT cookie.
  app.post("/api/auth/verify", async (req, reply): Promise<SessionInfo> => {
    const body = VerifySchema.safeParse(req.body);
    if (!body.success) {
      throw new BadRequestError(body.error.issues[0].message);
    }

    const sessionKey = getSessionKey(req);
    const expectedNonce = consumeNonce(sessionKey);
    if (!expectedNonce) {
      throw new BadRequestError("nonce expired or not found — request a new one");
    }

    const result = await verifySiwe(
      body.data.message,
      body.data.signature,
      expectedNonce
    );
    if (!result.ok) {
      throw new UnauthorizedError(result.error ?? "SIWE verification failed");
    }

    const { session } = await issueSession(reply, result.address);
    return {
      address: session.address,
      authenticatedAt: session.authenticatedAt,
      expiresAt: session.expiresAt,
    };
  });

  // POST /api/auth/logout — clear session cookie.
  app.post("/api/auth/logout", async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  // GET /api/auth/me — current session info (null if unauthenticated).
  app.get("/api/auth/me", async (req): Promise<SessionInfo | null> => {
    if (!req.session) return null;
    return {
      address: req.session.address,
      authenticatedAt: req.session.authenticatedAt,
      expiresAt: req.session.expiresAt,
    };
  });
}
