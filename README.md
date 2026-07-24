# LiquidAI

Rule-based AI manager for Uniswap v3 liquidity on **Ethereum Sepolia** (testnet only).

```bash
cp .env.example .env.local && cp .env.example .env   # add your Sepolia RPC + testnet key
npm install
npm run dev                                           # app → http://localhost:3000
npm run worker                                        # AI strategy cron engine (separate terminal)
```

Stack: Next.js 14 App Router · TypeScript strict · Tailwind · wagmi v2 + viem · @uniswap/v3-sdk · Recharts · node-cron worker.
