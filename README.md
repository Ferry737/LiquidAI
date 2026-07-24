<div align="center">

# 💧 Liquid<span style="color:#34d399">AI</span>

**A rule-based AI manager for Uniswap v3 liquidity — built for Ethereum Sepolia (testnet).**

[![Network](https://img.shields.io/badge/network-Sepolia-627eea?logo=ethereum&logoColor=white)](#)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-34d399.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-testnet%20demo-f59e0b)](#)

</div>

LiquidAI keeps your concentrated-liquidity positions in range and compounding
automatically. A sleek **Next.js dashboard** shows your positions, fees and
strategy at a glance, while a **cron-driven worker** runs a transparent,
rule-based engine that rebalances and auto-compounds on-chain.

> ⚠️ **Testnet only.** LiquidAI targets Ethereum **Sepolia**. Never point
> `WORKER_PRIVATE_KEY` at a wallet that holds mainnet funds.

---

## ✨ Features

- **📊 Live dashboard** — total value, unclaimed fees, average fee APR, and
  in-range position count at a glance.
- **🏊 Pool explorer** — browse Uniswap v3 pools and fee tiers (0.01% – 1%).
- **🎯 Position creator** — open concentrated positions with an interactive
  range chart and slippage control.
- **📈 Analytics** — performance breakdowns powered by Recharts.
- **🤖 Strategy engine** — a background worker that rebalances out-of-range
  positions and auto-compounds fees, with a **kill switch** and **slippage cap**.
- **🔌 Wallet-ready** — MetaMask + injected wallets via wagmi v2 / viem.

---

## 🧠 How the strategy engine works

The worker (`worker/`) runs on a cron schedule and evaluates every managed
position against three deterministic rules. The decision logic lives in
[`worker/strategy.ts`](worker/strategy.ts) and is **pure and side-effect free**,
so it is trivially unit-testable — `worker/index.ts` wires it to on-chain
execution via the Uniswap v3 `NonfungiblePositionManager`.

| Priority | Rule | Trigger | Action |
| :---: | :--- | :--- | :--- |
| 0 | **Kill switch** | `STRATEGY_KILL_SWITCH=true` | Hold everything |
| 1 | **Rebalance** | Out of range ≥ `REBALANCE_AFTER_HOURS` | Re-center range around current price (same width) |
| 2 | **Compound** | Unclaimed fees ≥ `COMPOUND_MIN_USD` | Collect fees |
| 3 | **Hold** | Within bounds | No action |

All on-chain legs are protected by `MAX_SLIPPAGE_BPS` slippage guards.

---

## 🏗 Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│        Next.js 14 app       │        │     Strategy worker (cron)   │
│      (App Router / RSC)     │        │       node-cron · tsx        │
│                             │        │                              │
│  Dashboard · Pools · Create │        │  load positions              │
│  Analytics · wagmi + viem   │        │     ↓                        │
│         Recharts UI         │        │  decide() ── pure rules      │
│             │               │        │     ↓                        │
│             ▼               │        │  execute on-chain            │
│   Uniswap v3 Subgraph       │        │  (NonfungiblePositionManager)│
└─────────────────────────────┘        └──────────────────────────────┘
                  │                                    │
                  └──────────────► Sepolia ◄───────────┘
```

---

## 🛠 Tech stack

| Layer | Tech |
| :--- | :--- |
| Framework | Next.js 14 (App Router), React 18 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Web3 | wagmi v2, viem, @uniswap/v3-sdk, @uniswap/sdk-core |
| Charts | Recharts |
| Data | TanStack React Query, Uniswap v3 Subgraph |
| Worker | node-cron, tsx, dotenv |

---

## 🚀 Quick start

### Prerequisites

- **Node.js 18+**
- A browser wallet (MetaMask) on the **Sepolia** network

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local   # used by the Next.js app
cp .env.example .env         # used by the worker
```

Then edit both files — see [Configuration](#-configuration).

### 3. Run the app

```bash
npm run dev                  # → http://localhost:3000
```

### 4. (Optional) Run the strategy worker

In a **second terminal**:

```bash
npm run worker
```

---

## ⚙️ Configuration

### App — `.env.local`

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_WALLETCONNECT_ID` | WalletConnect project ID | `demo` |
| `NEXT_PUBLIC_SEPOLIA_RPC` | Sepolia RPC URL | `https://rpc.sepolia.org` |
| `NEXT_PUBLIC_SUBGRAPH_URL` | Uniswap v3 Sepolia subgraph endpoint | The Graph hosted endpoint |

### Worker — `.env`

| Variable | Description | Default |
| :--- | :--- | :--- |
| `SEPOLIA_RPC` | Sepolia RPC URL | `https://rpc.sepolia.org` |
| `WORKER_PRIVATE_KEY` | Strategy-manager wallet key (**testnet only**) | `0x000…000` (ephemeral) |
| `STRATEGY_KILL_SWITCH` | `true` halts all automated actions | `false` |
| `MAX_SLIPPAGE_BPS` | Max slippage in basis points (50 = 0.5%) | `50` |
| `REBALANCE_AFTER_HOURS` | Rebalance if out of range longer than N hours | `6` |
| `COMPOUND_MIN_USD` | Auto-compound when unclaimed fees exceed this USD | `10` |
| `STRATEGY_CRON` | Cron schedule for the engine | `*/5 * * * *` |

> 🔑 Get a free Sepolia RPC from [Alchemy](https://www.alchemy.com/) or
> [Infura](https://infura.io/), and testnet ETH from a
> [Sepolia faucet](https://sepoliafaucet.com/). Fund a **dedicated test wallet**.

---

## 📁 Project structure

```
liquidai/
├── src/
│   ├── app/                  # Next.js App Router routes
│   │   ├── page.tsx          #   /        → Dashboard
│   │   ├── pools/            #   /pools   → Pool explorer
│   │   ├── create/           #   /create  → Position creator
│   │   └── analytics/        #   /analytics
│   ├── components/           # UI (dashboard, ui primitives, charts)
│   ├── hooks/                # usePositions, usePools, useAnimatedNumber
│   └── lib/                  # abi, constants, defi-math, subgraph, wagmi
├── worker/                   # AI strategy cron engine
│   ├── index.ts              #   on-chain execution + cron loop
│   ├── strategy.ts           #   pure decision rules
│   └── config.ts             #   env-driven config
├── .env.example
└── package.json
```

---

## 📜 Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run worker` | Start the strategy cron engine |
| `npm run lint` | Lint with Next.js / ESLint |
| `npm run typecheck` | Type-check with `tsc --noEmit` |

---

## 🗺 Roadmap

- [ ] Live on-chain position loading from `NonfungiblePositionManager`
- [ ] Full mint leg for rebalances (new range)
- [ ] Strategy backtesting sandbox
- [ ] Telegram / webhook alerts on rebalance & compound
- [ ] Multi-position portfolio simulation

---

## ⚠️ Disclaimer

LiquidAI is an **educational testnet project**. The strategy engine is
rule-based (not financial advice), automated execution can lose money to MEV /
slippage / bugs, and smart-contract interaction is inherently risky. **Do not
use real funds.** Use a dedicated test wallet, keep the kill switch handy, and
review the code before trusting it.

---

## 📄 License

[MIT](LICENSE) © Ferry737
