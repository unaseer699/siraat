# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/frontend/ apps/frontend/

RUN pnpm install --frozen-lockfile

# next build produces .next/standalone/ when output: 'standalone' is set in next.config.js
RUN pnpm --filter frontend build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Standalone output mirrors the monorepo structure: server.js lands at
# apps/frontend/server.js relative to the standalone root.
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
