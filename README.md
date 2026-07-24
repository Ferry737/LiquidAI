# LiquidAI

Rule-based AI manager for Uniswap v3 liquidity on **Ethereum Sepolia** (testnet only).

## Run v1.1

```bash
cp .env.example .env.local && cp .env.example .env && cp .env.example server/.env
npm install && npm install --prefix server
npm run dev        # web → http://localhost:3000 · api → http://localhost:4000 (health: /health)
```

`npm run worker` still runs the AI strategy cron engine in a separate terminal.

Stack: Next.js 14 App Router · TypeScript strict · Tailwind · wagmi v2 + viem · @uniswap/v3-sdk · Recharts · node-cron worker · **Fastify API (v1.1)** with Zod-validated Uniswap subgraph + DefiLlama clients, TTL cache, rate limiting, and typed errors.
