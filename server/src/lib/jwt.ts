// server/src/lib/jwt.ts
// v1.4: JWT signing and verification via jose (HS256).
// Stateless sessions — no server-side session store needed.

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config";

const COOKIE_NAME = "liquidai_session";
const ALG = "HS256";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(config.JWT_SECRET);
}

export interface SessionPayload extends JWTPayload {
  /** EVM address (lowercased). */
  sub: string;
}

/** Sign a JWT containing the wallet address, valid for JWT_TTL_SEC seconds. */
export async function signSessionToken(address: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: address.toLowerCase() })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + config.JWT_TTL_SEC)
    .setIssuer("liquidai")
    .setSubject(address.toLowerCase())
    .sign(getSecret());
}

/** Verify a JWT and return the decoded payload, or null if invalid/expired. */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "liquidai",
    });
    if (typeof payload.sub !== "string" || !payload.sub.startsWith("0x")) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** The cookie name used for the session JWT. */
export const SESSION_COOKIE_NAME = COOKIE_NAME;

/**
 * Cookie attributes for the session JWT.
 *
 * In production the frontend (Vercel) and API (Render) live on different
 * origins, so the cookie MUST be `sameSite: "none"` + `secure` to cross the
 * CORS boundary (credentials: "include" is already set on every fetch).
 * On localhost both run on the same origin, where "strict" works and avoids
 * sending cross-site cookies in dev.
 */
const isProd = process.env.NODE_ENV === "production";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  // "none" REQUIRES secure=true; only safe to set in production.
  sameSite: (isProd ? "none" : "strict") as "none" | "strict",
  path: "/",
  maxAge: config.JWT_TTL_SEC,
} as const;
