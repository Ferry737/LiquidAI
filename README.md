<p align="center">
  <img src="https://img.shields.io/badge/LiquidAI-1.5-00d4ff?style=for-the-badge&logo=ethereum&logoColor=white" alt="LiquidAI 1.5" />
  <img src="https://img.shields.io/badge/Testnet-Ethereum%20Sepolia-627eea?style=for-the-badge&logo=ethereum&logoColor=white" alt="Sepolia" />
  <img src="https://img.shields.io/badge/Uniswap-v3-FF007A?style=for-the-badge&logo=uniswap&logoColor=white" alt="Uniswap v3" />
  <img src="https://img.shields.io/badge/License-MIT-8a2be2?style=for-the-badge" alt="MIT" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/Fastify-API-000000?style=flat-square&logo=fastify" alt="Fastify" />
  <img src="https://img.shields.io/badge/Prisma-Postgres-2d3748?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vitest-passing-46c93a?style=flat-square&logo=vitest" alt="Vitest" />
</p>

<h1 align="center">LiquidAI</h1>

<p align="center">
  <b>A rule-based AI manager for Uniswap v3 liquidity.</b><br/>
  Automated range management, real-time telemetry, wallet-native auth, and safe dry-run simulation —<br/>
  engineered for <b>Ethereum Sepolia</b> (testnet).
</p>

---

> **LiquidAI** turns passive Uniswap v3 positions into actively-managed, strategy-driven liquidity.
> Define a policy, watch it execute in real time, and stay alerted — all without risking a single
> transaction you didn't explicitly approve. Built for engineers who want automation they can audit.

## ✨ Highlights

| Capability | What it does |
| --- | --- |
| 🌀 **Automated Strategy Engine** | A `node-cron` worker continuously evaluates positions against configurable range/rebalance rules. |
| 📡 **Real-Time SSE Layer** | Live position status, in/out-of-range pills, and an event feed streamed over Server-Sent Events with auto-reconnect. |
| 🤖 **Telegram Alerts** | Per-event gated notifications via the Telegram Bot API — know the moment something moves. |
| 🧪 **Dry-Run Simulation** | Every transaction is pre-executed with `eth_call` + `estimateGas` before it ever hits the wire. Flip to Live only when you're ready. |
| 🗄️ **Durable State** | Prisma + Postgres persistence: per-position strategy configs, snapshot history, action log, and notification settings. |
| 🛡️ **Typed, Bounded API** | Fastify with Zod-validated subgraph + DefiLlama clients, TTL caching, rate limiting, and structured error envelopes. |
| 🔐 **Wallet-Native SIWE Auth** | Sign in with Ethereum (EIP-4361) → 24h httpOnly session JWT; ownership guards on every mutating route. |
| 📊 **Backtesting Engine** | Replay hourly subgraph data across Conservative / Balanced / Aggressive presets vs a HODL baseline — fee share, IL, rebalance/compound/stop-loss rules. |
| ✅ **Tested Core** | Vitest suite covering the strategy matrix, Zod schemas, client parsing, and the v1.4 EventBus / SSE / Telegram / Simulation / Auth / Backtest layers. |

---

## 🏗️ Architecture

```
                ┌─────────────────────────────┐
                │     Next.js 14 (App Router) │  Web UI  ·  :3000
                │   wagmi v2 · viem · Tailwind │  Recharts dashboards
                └───────────────┬─────────────┘
                                │  REST + SSE (/api/stream)
                ┌───────────────▼─────────────┐
                │      Fastify API  ·  :4000   │  Zod-validated routes
                │  TTL cache · rate limit ·    │  typed error envelopes
                │  EventBus pub/sub            │
                └───┬───────────┬───────────┬──┘
                    │           │           │
            ┌───────▼───┐ ┌─────▼─────┐ ┌───▼──────────┐
            │  Prisma / │ │  node-cron │ │  Uniswap     │
            │ Postgres  │ │  Worker    │ │  Subgraph +  │
            │           │ │ Simulation │ │  DefiLlama   │
            └───────────┘ └─────┬─────┘ └──────────────┘
                                │ dry-run eth_call + estimateGas
                                └──────────▶ Telegram Bot API (alerts)
```

A single EventBus fans real-time signals out to both the SSE stream (UI) and the Telegram
notifier, so what you see is exactly what gets alerted.

---

## 🚀 Quick Start

```bash
# 1. Bootstrap environment files
cp .env.example .env.local && cp .env.example .env && cp .env.example server/.env

# 2. Bring up Postgres + install dependencies
docker compose up -d && npm install && npm install --prefix server

# 3. Generate & apply the Prisma schema
npx --prefix server prisma generate && npx --prefix server prisma migrate deploy

# 4. Run the stack
npm run dev        # web → :3000 · api → :4000 (health: /health)
```

Run the strategy engine in the background (dry-run by default):

```bash
npm run worker     # AI strategy cron engine — safe by default
```

### 🔐 v1.4 — Wallet-native auth & backtesting

1. **Sign-in flow (SIWE)**: connect your wallet, then hit **Sign in** in the header — the app fetches a nonce from `/api/auth/nonce`, you sign an EIP-4361 message, and the backend sets a 24h httpOnly session cookie. All mutating routes (strategy configs, notifications, engine toggle, backtests) require it; set `JWT_SECRET` in `server/.env`.
2. **Running a backtest**: open **Backtest**, pick a pool, date range and initial USD, then **Run comparison** — the three presets (Conservative / Balanced / Aggressive) replay hourly subgraph data in parallel with a dashed HODL baseline, results table and winner card. Hourly `poolHourData` is cached in Postgres, so re-runs skip refetching.
3. **Presets**: `shared/presets.ts` defines the three presets; the position Strategy drawer has one-click **Apply preset** chips that write the values into your `StrategyConfig`.

---

## 🔌 Connecting the Pieces

<details>
<summary><b>🤖 Telegram Alerts</b></summary>

1. Create a bot via [@BotFather](https://t.me/BotFather) (`/newbot`) and copy the token.
2. Set `TELEGRAM_BOT_TOKEN` in `server/.env`.
3. Open **Settings** in the app, enter your chat ID (grab it from [@userinfobot](https://t.me/userinfobot)), and send a test message.

</details>

<details>
<summary><b>🧪 Dry-Run → Live Toggle</b></summary>

The header **Live / Dry Run** switch controls the engine globally.

- **Dry Run** (default): the worker simulates every transaction (`eth_call` + `estimateGas`)
  and logs each action as `DRY_RUN` — nothing is broadcast.
- **Live**: switching on shows a confirmation modal before any real transaction is signed and sent.

</details>

<details>
<summary><b>📡 Real-Time Feed</b></summary>

The dashboard streams position status and strategy actions over SSE (`/api/stream`):

- In-range / out-of-range pills and value counters update live.
- The **Engine Feed** panel shows each action as it happens.

</details>

---

## 🧰 Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js 14 (App Router) · TypeScript (strict) · Tailwind · wagmi v2 + viem · @uniswap/v3-sdk · Recharts |
| **API** | Fastify · Zod-validated Uniswap subgraph + DefiLlama clients · TTL cache · rate limiting · typed errors |
| **Persistence** | Prisma + Postgres — per-position strategy configs, snapshot history, action log, notification settings, engine state |
| **Real-Time** | SSE layer with EventBus pub/sub and auto-reconnect |
| **Alerting** | Telegram Bot API with per-event gating |
| **Simulation** | `SimulationService` — pre-execution `eth_call` + `estimateGas` with gas-cost estimation |
| **Auth** | SIWE (EIP-4361) via viem `verifySiweMessage`, `jose` HS256 JWT in httpOnly SameSite=Strict cookie, ownership guards |
| **Backtesting** | Pure hourly replay — fee-share approximation, IL vs HODL, rebalance/compound/stop-loss rules, preset comparison UI |
| **Tests / CI** | Vitest (strategy matrix, schemas, client parsing, EventBus/SSE/Telegram/Simulation/Auth/Backtest) · GitLab CI (lint → typecheck → test) |

---

## 🗺️ Roadmap

- [x] v1.1 — Fastify API server, verified-APY frontend, test/CI foundation
- [x] v1.2 — Persistence, configurable strategies, tests + CI
- [x] v1.3 — Real-time SSE layer, Telegram alerts, simulation-backed dry-run mode
- [x] v1.4 — Wallet-native SIWE session auth & strategy backtesting

---

## 📜 License

[MIT](LICENSE) © LiquidAI

<p align="center">
  <sub>Built for Ethereum Sepolia. Testnet only — no mainnet funds at risk.</sub>
</p>
