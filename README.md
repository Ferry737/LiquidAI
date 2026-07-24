# LiquidAI

Rule-based AI manager for Uniswap v3 liquidity on **Ethereum Sepolia** (testnet only).

## Run v1.2

```bash
cp .env.example .env.local && cp .env.example .env && cp .env.example server/.env
docker compose up -d && npm install && npm install --prefix server
npx --prefix server prisma generate && npx --prefix server prisma migrate deploy
npm run dev        # web → :3000 · api → :4000 (health: /health)
```

`npm run worker` runs the AI strategy cron engine (dry-run by default).

Stack: Next.js 14 App Router · TypeScript strict · Tailwind · wagmi v2 + viem · @uniswap/v3-sdk · Recharts · node-cron worker · **Fastify API** with Zod-validated Uniswap subgraph + DefiLlama clients, TTL cache, rate limiting, typed errors · **Prisma + Postgres** persistence (v1.2) with per-position strategy configs, snapshot history, and an action log · **Vitest** test suite (strategy matrix, zod schemas, client parsing) · **GitLab CI** (lint → typecheck → test, parallel web/server jobs).
