// server/src/lib/auth.ts
// v1.4: SIWE authentication — nonce generation/storage, message verification,
// and Fastify auth plugin (preHandler guard).
//
// Design:
// - Nonces are stored in-memory (Map) with a 10-minute TTL. This is
//   sufficient for a stateless JWT session model. For multi-instance
//   deployments, swap the nonce store for Redis.
// - verifySiweMessage from viem performs local ecrecover (no on-chain call
//   needed for EOA signatures), so verification is fast and deterministic.
// - The Fastify plugin decorates the request with `req.session` (address or
//   null). Routes use `requireAuth` preHandler to enforce authentication, and
//   `requireOwner(owner)` to enforce resource ownership.

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import "@fastify/cookie"; // augments FastifyRequest/Reply with cookies API
import {
  generateSiweNonce,
  parseSiweMessage,
} from "viem/siwe";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import type { Address, Hex } from "viem";
import { config } from "./config";
import { ApiError } from "./errors";
import {
  signSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "./jwt";
import type { SessionInfo } from "../../../shared/types";

// ---- Nonce store (in-memory, 10-minute TTL) ----

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const nonceStore = new Map<string, NonceEntry>();

/** Cleanup expired nonces. Called on each generation. */
function pruneNonces(): void {
  const now = Date.now();
  nonceStore.forEach((entry, key) => {
    if (entry.expiresAt < now) nonceStore.delete(key);
  });
}

/** Generate and store a nonce for a session key. Returns the nonce string. */
export function generateNonce(sessionKey: string): string {
  pruneNonces();
  const nonce = generateSiweNonce();
  nonceStore.set(sessionKey, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
}

/** Consume (read + delete) a nonce for a session key. Returns null if not found/expired. */
export function consumeNonce(sessionKey: string): string | null {
  const entry = nonceStore.get(sessionKey);
  if (!entry) return null;
  nonceStore.delete(sessionKey); // one-time use
  if (entry.expiresAt < Date.now()) return null;
  return entry.nonce;
}

// ---- Session key extraction ----

/**
 * Derive a session key from the request. We use a combination of IP + a
 * session cookie (pre-auth) to scope nonces to a browser session.
 * Falls back to IP-only if no pre-auth cookie is present.
 */
export function getSessionKey(req: FastifyRequest): string {
  const ip = req.ip;
  const preAuthCookie = (req.cookies as Record<string, string> | undefined)?.[
    "liquidai_preauth"
  ];
  return preAuthCookie ? `${ip}:${preAuthCookie}` : ip;
}

// ---- viem client for SIWE verification ----

/**
 * A viem public client used for verifySiweMessage.
 * verifySiweMessage does local ecrecover for EOA signatures (no RPC needed),
 * but requires a client object to be passed.
 */
function createSiweClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(config.SEPOLIA_RPC_URL),
  });
}

let _siweClient: ReturnType<typeof createSiweClient> | null = null;

/** Injectable for tests. */
export function setSiweClient(client: ReturnType<typeof createSiweClient>): void {
  _siweClient = client;
}

function getSiweClient() {
  if (!_siweClient) _siweClient = createSiweClient();
  return _siweClient;
}

// ---- SIWE verification ----

export interface VerifyResult {
  ok: boolean;
  address: string;
  error?: string;
}

/**
 * Verify a SIWE message + signature.
 * Checks: valid EIP-4361 message, signature matches address, domain matches
 * FRONTEND_ORIGIN host, nonce matches the one issued.
 *
 * `expectedNonce` should come from consumeNonce(sessionKey).
 */
export async function verifySiwe(
  message: string,
  signature: string,
  expectedNonce: string
): Promise<VerifyResult> {
  // Parse the SIWE message to extract fields.
  const parsed = parseSiweMessage(message);
  if (!parsed.address) {
    return { ok: false, address: "", error: "invalid SIWE message: no address" };
  }
  if (!parsed.nonce) {
    return { ok: false, address: "", error: "invalid SIWE message: no nonce" };
  }
  if (!parsed.domain) {
    return { ok: false, address: "", error: "invalid SIWE message: no domain" };
  }

  // Check nonce matches.
  if (parsed.nonce !== expectedNonce) {
    return { ok: false, address: "", error: "nonce mismatch" };
  }

  // Check domain matches the frontend origin host.
  const expectedDomain = safeHostname(config.FRONTEND_ORIGIN);
  if (expectedDomain && parsed.domain !== expectedDomain) {
    return {
      ok: false,
      address: "",
      error: `domain mismatch: expected ${expectedDomain}, got ${parsed.domain}`,
    };
  }

  // Verify signature using viem.
  const client = getSiweClient();
  const isValid = await client.verifySiweMessage({
    message,
    signature: signature as Hex,
    nonce: expectedNonce,
    domain: parsed.domain,
    address: parsed.address as Address,
  });

  if (!isValid) {
    return { ok: false, address: "", error: "signature verification failed" };
  }

  return { ok: true, address: parsed.address.toLowerCase() };
}

/** Extract hostname from a URL, returning "" if parse fails. */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// ---- Session management ----

export interface AuthSession {
  address: string;
  authenticatedAt: number;
  expiresAt: number;
}

/**
 * Issue a session JWT and set it as a cookie on the reply.
 */
export async function issueSession(
  reply: FastifyReply,
  address: string
): Promise<{ token: string; session: AuthSession }> {
  const token = await signSessionToken(address);
  const now = Date.now();
  reply.setCookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return {
    token,
    session: {
      address: address.toLowerCase(),
      authenticatedAt: now,
      expiresAt: now + config.JWT_TTL_SEC * 1000,
    },
  };
}

/** Clear the session cookie. */
export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

/**
 * Read and verify the session JWT from the request cookie.
 * Returns the session info or null.
 */
export async function readSession(
  req: FastifyRequest
): Promise<AuthSession | null> {
  const token = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE_NAME
  ];
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const issuedAt = payload.iat ? payload.iat * 1000 : Date.now();
  const expiresAt = payload.exp ? payload.exp * 1000 : 0;
  return {
    address: payload.sub,
    authenticatedAt: issuedAt,
    expiresAt,
  };
}

/**
 * Resolve the session from the request and attach it to `req.session`.
 * Called as a global preHandler — always runs, never rejects (public routes
 * just get session=null).
 *
 * v1.6: E2E mock mode (MOCK_CHAIN + NODE_ENV=test ONLY — config.mockChain is
 * hard-false otherwise) injects a stub session so Playwright specs can hit
 * auth-guarded routes without a real wallet.
 */
async function sessionResolver(req: FastifyRequest, _reply: FastifyReply) {
  if (config.mockChain) {
    const now = Date.now();
    req.session = {
      address: "0x00000000000000000000000000000000000e2e00",
      authenticatedAt: now,
      expiresAt: now + 3_600_000,
    };
    return;
  }
  req.session = await readSession(req);
}

/**
 * preHandler that requires a valid authenticated session.
 * Usage: `{ preHandler: [app.requireAuth] }` or `{ preHandler: [app.auth, app.requireAuth] }`.
 */
function requireAuth(req: FastifyRequest, _reply: FastifyReply) {
  if (!req.session) {
    throw new ApiError(401, "UNAUTHORIZED", "authentication required");
  }
}

// ---- Fastify plugin ----

/**
 * Register the auth layer:
 * 1. Decorate FastifyRequest with `session: AuthSession | null`.
 * 2. Add `requireAuth` and `auth` decorators.
 * 3. Register a global preHandler to resolve the session on every request.
 *
 * Wrapped in fastify-plugin so the decorators escape plugin encapsulation
 * and are visible to sibling route plugins (app.requireAuth).
 * Must be registered AFTER @fastify/cookie.
 */
export const authPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  // Decorate request type.
  app.decorateRequest("session", null as AuthSession | null);
  app.decorate("requireAuth", requireAuth);
  app.decorate("auth", sessionResolver);
  // Resolve session on every request.
  app.addHook("preHandler", sessionResolver);
}, { name: "liquidai-auth" });

// ---- Helper: resource ownership check ----

/**
 * Check that the authenticated session address matches the resource owner
 * (case-insensitive). Throw 403 if mismatch.
 */
export function assertOwnership(
  session: AuthSession | null,
  owner: string
): void {
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "authentication required");
  }
  if (session.address.toLowerCase() !== owner.toLowerCase()) {
    throw new ApiError(403, "FORBIDDEN", "not the resource owner");
  }
}

// ---- Type augmentation for FastifyRequest ----

declare module "fastify" {
  interface FastifyRequest {
    session: AuthSession | null;
  }
  interface FastifyInstance {
    requireAuth: typeof requireAuth;
    auth: typeof sessionResolver;
  }
}

export { type SessionInfo };
