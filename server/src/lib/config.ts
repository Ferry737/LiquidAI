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
});

export type AppConfig = z.infer<typeof EnvSchema>;

export const config: AppConfig = EnvSchema.parse(process.env);
