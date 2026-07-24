// server/src/lib/config.ts
import { z } from "zod";

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
});

export type AppConfig = z.infer<typeof EnvSchema>;

export const config: AppConfig = EnvSchema.parse(process.env);
