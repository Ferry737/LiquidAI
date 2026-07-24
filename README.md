# LiquidAI

Rule-based AI manager for Uniswap v3 liquidity on **Ethereum Sepolia** (testnet only).

## Run v1.4

```bash
cp .env.example .env.local && cp .env.example .env && cp .env.example server/.env
docker compose up -d && npm install && npm install --prefix server
npx --prefix server prisma generate && npx --prefix server prisma migrate deploy
npm run dev        # web → :3000 · api → :4000 (health: /health)
```

`npm run worker` runs the AI strategy cron engine (dry-run by default).

### v1.4 notes

1. **Sign-in flow (SIWE)**: connect your wallet, then hit **Sign in** in the header — the app fetches a nonce from `/api/auth/nonce`, you sign an EIP-4361 message, and the backend sets a 24h httpOnly session cookie. All mutating routes (strategy configs, notifications, engine toggle, backtests) require it; set `JWT_SECRET` in `server/.env`.
2. **Running a backtest**: open **Backtest**, pick a pool, date range and initial USD, then **Run comparison** — the three presets (Conservative / Balanced / Aggressive) replay hourly subgraph data in parallel with a dashed HODL baseline, results table and winner card. Hourly `poolHourData` is cached in Postgres, so re-runs skip refetching.
3. **Presets**: `shared/presets.ts` defines the three presets; the position Strategy drawer has one-click **Apply preset** chips that write the values into your `StrategyConfig`.

### v1.3 notes

1. **Telegram alerts**: create a bot via [@BotFather](https://t.me/BotFather) (`/newbot`), copy the token into `TELEGRAM_BOT_TOKEN`, then open Settings → enter your chat ID (from [@userinfobot](https://t.me/userinfobot)) and send a test message.
2. **Dry-run toggle**: the header Live/Dry Run switch controls the engine globally. In Dry Run mode the worker simulates every transaction (eth_call + estimateGas) and logs actions as `DRY_RUN` without sending transactions. Switching to Live shows a confirmation modal.
3. **Real-time feed**: the dashboard streams position status and strategy actions over SSE (`/api/stream`) — in/out-of-range pills and value counters update live, and the Engine Feed panel shows each action as it happens.

Stack: Next.js 14 App Router · TypeScript strict · Tailwind · wagmi v2 + viem · @uniswap/v3-sdk · Recharts · node-cron worker · **Fastify API** with Zod-validated Uniswap subgraph + DefiLlama clients, TTL cache, rate limiting, typed errors · **Prisma + Postgres** persistence with per-position strategy configs, snapshot history, action log, notification settings, and engine state (v1.3) · **SSE real-time layer** with EventBus pub/sub and auto-reconnect (v1.3) · **Telegram Bot API** alerts with per-event gating (v1.3) · **SimulationService** pre-execution eth_call + estimateGas with gas-cost estimation (v1.3) · **Vitest** test suite (strategy matrix, zod schemas, client parsing, v1.3 EventBus/SSE/Telegram/Simulation/Notification tests) · **SIWE auth** (viem `verifySiweMessage`, jose HS256 JWT in httpOnly SameSite=Strict cookie, ownership guards on all mutating routes) (v1.4) · **Backtesting engine** (pure hourly replay: fee-share approximation, IL vs HODL, rebalance/compound/stop-loss rules, preset comparison UI with Recharts) (v1.4) · **GitLab CI** (lint → typecheck → test, parallel web/server jobs).
