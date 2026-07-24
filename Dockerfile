# syntax=docker/dockerfile:1
# LiquidAI — single image runs EITHER the Fastify API (SERVICE_TYPE=api) or
# the node-cron strategy worker (SERVICE_TYPE=worker). Same image is deployed
# twice on Render: Web Service (API) + Background Worker.
#
# Monorepo note: the worker (repo root) imports "@prisma/client", whose real
# install lives under /server/node_modules. We point NODE_PATH at the server
# tree when launching the worker so it resolves the generated Prisma client.
# The server resolves its own deps (fastify, @fastify/*, @prisma/client) from
# its own /app/server/node_modules tree normally.

FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy manifests for reproducible installs
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/

# Production deps for both workspaces (root has @fastify/cookie + node-cron;
# server has fastify/prisma). --ignore-scripts skips the prisma postinstall.
RUN npm ci --omit=dev --ignore-scripts \
 && cd server && npm ci --omit=dev --ignore-scripts

# Prisma client generation (pinned 5.x resolves from server/package-lock.json)
COPY server/prisma ./server/prisma
RUN cd server && npx prisma generate

# Application source
COPY server/src ./server/src
COPY shared ./shared
COPY worker ./worker

# tsx needed to run TS entrypoints at runtime
RUN npm install -g tsx

EXPOSE 4000
# api  -> Fastify HTTP server (Render Web Service, NODE_PATH harmless here)
# worker -> strategy engine; NODE_PATH lets it find @prisma/client in server tree
CMD ["sh", "-c", "if [ \"$SERVICE_TYPE\" = worker ]; then \
        NODE_PATH=/app/server/node_modules exec tsx worker/index.ts; \
      else \
        exec tsx server/src/index.ts; fi"]
