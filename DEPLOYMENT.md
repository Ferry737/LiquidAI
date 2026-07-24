# LiquidAI — Free Deployment Guide

LiquidAI is a **full-stack** app (Next.js frontend + Fastify API + node-cron
worker + Postgres). It cannot run on GitHub Pages (static-only) and a GitHub
Action alone can't *host* it (Actions are ephemeral build runners). Instead,
a GitHub Action **auto-deploys** the code to free hosts on every push to
`main`.

## Architecture (free tier)

| Piece | Host | Free tier notes |
|-------|------|-----------------|
| Frontend (Next.js) | **Vercel** | Free, native GitHub auto-deploy |
| API (Fastify) | **Render** Web Service | Free; sleeps after 15 min idle |
| Worker (strategy engine) | **Render** Background Worker | Free; sleeps after 15 min idle |
| Database (Postgres) | **Render Postgres** (free) | 90-day expiry — see "DB caveats" below |

> Prefer Neon/Supabase for the DB? Replace the `databases:` block in
> `render.yaml` with a `DATABASE_URL` env var pointing at your Neon project
> (set it in the Render dashboard). Everything else is identical.

## What was changed for deployment

- `server/src/lib/jwt.ts` — session cookie is now `SameSite=None; Secure` in
  production so SIWE auth works across the Vercel ↔ Render origin split
  (it stays `SameSite=Strict` in dev).
- `Dockerfile` — single image that runs **either** the API (`SERVICE_TYPE=api`)
  or the worker (`SERVICE_TYPE=worker`), with a correct monorepo Prisma client
  build. The worker imports `@prisma/client` from the server tree, so both
  share one `node_modules` in the image.
- `render.yaml` — Render Blueprint defining the API web service, the worker,
  and the Postgres database.
- `vercel.json` — Vercel project config that points the frontend at the Render
  API via `NEXT_PUBLIC_API_BASE`.
- `.github/workflows/deploy.yml` — CI (typecheck + tests) + deploy hooks for
  Vercel and Render.

## Step-by-step (≈15 min)

### 1. GitHub secrets (one-time)
In **GitHub → Settings → Secrets and variables → Actions**, add:
- `VERCEL_TOKEN` — from https://vercel.com/account/tokens
- `VERCEL_ORG_ID` — `vercel whoami` (or from project settings)
- `VERCEL_PROJECT_ID` — from the Vercel project settings page
- `RENDER_DEPLOY_HOOK` — created in step 3 below

### 2. Vercel (frontend)
1. https://vercel.com/new → import `Ferry737/LiquidAI`.
2. Framework preset: **Next.js** (auto-detected via `vercel.json`).
3. Deploy. Copy the production URL (e.g. `https://liquidai.vercel.app`).
4. In Vercel project **Settings → Environment Variables**, set
   `NEXT_PUBLIC_API_BASE=https://liquidai-api.onrender.com`
   (use the Render URL from step 3, after it's created).
5. Redeploy.

### 3. Render (API + worker + DB)
1. https://dashboard.render.com/blueprints → **New Blueprint Instance** →
   connect the GitHub repo. Render reads `render.yaml` and creates 3 services.
2. Fill the required `sync: false` secrets in the dashboard:
   - `JWT_SECRET` → `openssl rand -hex 32`
   - `FRONTEND_ORIGIN` → your Vercel URL (`https://liquidai.vercel.app`)
   - `WORKER_PRIVATE_KEY` → a Sepolia testnet key (or leave default; worker
     runs in dry-run with an ephemeral key)
   - `TELEGRAM_BOT_TOKEN` → optional (from @BotFather)
3. Deploy. Note the API URL (`https://liquidai-api.onrender.com`).
4. Go to the **liquidai-api** service → **Settings → Deploy Hook** → create a
   hook, then paste that URL into the GitHub `RENDER_DEPLOY_HOOK` secret.

### 4. Done
Any `git push` to `main` now: runs typecheck + tests, deploys the frontend to
Vercel (`--prod`), and triggers a Render rebuild of the API + worker.

## DB caveats (free tier)
- Render's free Postgres **expires after 90 days**. Before expiry, either:
  - upgrade to a paid plan, or
  - migrate `DATABASE_URL` to **Neon** / **Supabase** (free, no expiry) by
    editing `render.yaml` and redeploying.
- The app degrades gracefully without a DB (live subgraph data still works);
  only persistence (strategies, history, backtests) needs Postgres.

## Local vs deployed env
- Deployed API reads `DATABASE_URL` (auto-injected from the DB service).
- `WORKER_DRY_RUN=true` is the safe default — flip to `false` in the Render
  dashboard (worker env) only when you want real Sepolia transactions.
- Never set `WORKER_PRIVATE_KEY` to a mainnet-funded wallet. Testnet only.
