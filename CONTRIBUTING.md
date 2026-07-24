# Contributing to LiquidAI

Thanks for your interest in improving LiquidAI! 🧪 This is a testnet project and
all contributions are welcome — bug reports, fixes, features, and docs.

## Getting started

1. **Fork & clone** the repo.
2. **Install deps:** `npm install`
3. **Configure env:** `cp .env.example .env.local` (and `.env` for the worker).
4. **Run the app:** `npm run dev` → http://localhost:3000
5. **(Optional) Run the worker:** `npm run worker`

## Development workflow

- Create a branch from `main`: `git checkout -b feat/your-feature`.
- Keep changes focused — one logical change per PR.
- **Before opening a PR:**
  ```bash
  npm run typecheck   # tsc --noEmit
  npm run lint
  ```
- Commit messages: use the Conventional Commits style
  (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

## Code style

- **TypeScript strict** — no `any` without a justification comment.
- Keep the worker's decision logic in `worker/strategy.ts` **pure and
  side-effect free**; wire side effects in `worker/index.ts`.
- Match the existing component structure under `src/components/`.

## Safety

- 🔑 **Never commit secrets.** `.env`, `.env.local`, and private keys are
  gitignored — keep them out of diffs and screenshots.
- ⚠️ **Testnet only.** Do not add mainnet contract addresses or funded keys.

## Reporting issues

Open an issue with:
- What you expected vs. what happened.
- Steps to reproduce (Sepolia only).
- Relevant logs from the app or `npm run worker`.

Happy building! 💧
