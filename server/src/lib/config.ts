// server/src/lib/config.ts
// Zod-validated environment. v1.6: multi-chain env validation (fail fast at
// boot on invalid chain env), CHAINS_ENABLED, MOCK_CHAIN (test-only fixtures).

import { z } from "zod";
import {
  parseEnabledChains,
  validateChainEnv,
  type ChainSlug,
  type ResolvedChainEnv,
} from "../../../shared/chains";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  SUBGRAPH_URL: z
    .string()
    .url()
    .default(
      "https://api.studio.thegraph.com/query/uniswap/uniswap-v3-sepolia/version/latest"
    ),
  DEFILLAMA_BASE: z.string().url().default("https://api.llama.fi"),
  DEFILLAMA_YIELDS_BASE: z.string().url().default("https://yields.llama.fi"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  // v1.2
  DATABASE_URL: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.startsWith("postgres"),
      "DATABASE_URL must be a postgres:// connection string"
    ),
  // v1.3: Telegram Bot API
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  // v1.3: Sepolia RPC for simulation service
  SEPOLIA_RPC_URL: z
    .string()
    .url()
    .default("https://rpc.sepolia.org"),
  // v1.4: SIWE auth — JWT signing secret. Must be set for auth to work.
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters")
    .default("dev-secret-change-me-in-production-32chars"),
  // v1.4: JWT lifetime in seconds (default 24h).
  JWT_TTL_SEC: z.coerce.number().int().positive().default(86400),
  // v1.6: comma-separated chain slugs to enable (default: all).
  CHAINS_ENABLED: z.string().optional(),
  // v1.6: E2E mock mode — fixture data + auth bypass. ONLY honored when
  // NODE_ENV=test (enforced below and everywhere it is consumed).
  MOCK_CHAIN: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  /** v1.6: enabled chains (validated). */
  enabledChains: ChainSlug[];
  /** v1.6: resolved per-chain RPC + subgraph URLs. */
  chainEnv: Record<ChainSlug, ResolvedChainEnv>;
  /** v1.6: true ONLY when MOCK_CHAIN is set AND NODE_ENV=test. */
  mockChain: boolean;
};

function buildConfig(): AppConfig {
  const base = EnvSchema.parse(process.env);

  // v1.6: multi-chain env validation — fail fast on any invalid chain env.
  const { slugs, errors: chainSelErrors } = parseEnabledChains(
    base.CHAINS_ENABLED
  );
  const validation = validateChainEnv(process.env, slugs);
  const errors = [...chainSelErrors, ...validation.errors];
  if (errors.length > 0) {
    throw new Error(`chain env validation failed:\n  - ${errors.join("\n  - ")}`);
  }

  // MOCK_CHAIN is gated to NODE_ENV=test — refuse to run mocked outside tests.
  const mockChain = !!base.MOCK_CHAIN && process.env.NODE_ENV === "test";
  if (base.MOCK_CHAIN && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn(
      "[config] MOCK_CHAIN ignored: only honored when NODE_ENV=test"
    );
  }

  return {
    ...base,
    enabledChains: slugs,
    chainEnv: validation.resolved,
    mockChain,
  };
}

export const config: AppConfig = buildConfig();
