# LiquidAI — Free Deploy Checklist

The repo is now deploy-ready. You do the account wiring (~15 min); the code,
GitHub Action, and configs are done.

## Repo already contains
- [x] Dockerfile (single image → API or worker via SERVICE_TYPE)
- [x] render.yaml (API web service + worker + Postgres, free tier)
- [x] vercel.json (frontend → Render API via NEXT_PUBLIC_API_BASE)
- [x] .github/workflows/deploy.yml (CI + Vercel/Render deploy hooks)
- [x] jwt.ts fix: SameSite=None;Secure in prod (cross-origin SIWE)
- [x] DEPLOYMENT.md (full guide)

## You need to do (in this order)
1. [ ] Push this commit to GitHub `main` (the workflow file must exist in the repo).
2. [ ] Vercel: import repo, deploy, copy production URL.
3. [ ] Render: New Blueprint Instance from repo → fills 3 services. Set secrets:
       - JWT_SECRET = `openssl rand -hex 32`
       - FRONTEND_ORIGIN = your Vercel URL
       - WORKER_PRIVATE_KEY (optional, Sepolia key only)
4. [ ] Vercel env: set NEXT_PUBLIC_API_BASE = https://liquidai-api.onrender.com, redeploy.
5. [ ] Render: create Deploy Hook on the API service → paste URL into GitHub
       secret RENDER_DEPLOY_HOOK.
6. [ ] GitHub secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, RENDER_DEPLOY_HOOK.

## Free-tier gotchas
- Render free services sleep after 15 min idle → first request after idle is slow.
- Render free Postgres expires after 90 days → migrate to Neon/Supabase before then.
- Worker is dry-run by default (safe). Flip WORKER_DRY_RUN=false to execute on Sepolia.
