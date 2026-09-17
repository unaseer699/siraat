# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace manifests first (layer cache: only re-install if lockfile changes)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/backend/ apps/backend/

RUN pnpm install --frozen-lockfile

# Build workspace packages that the backend depends on
RUN pnpm --filter @siraat/shared-types build

# Compile NestJS to dist/
RUN pnpm --filter backend build

# Collect production dependencies only (resolves workspace packages, strips devDeps).
# pnpm deploy copies the package directory contents (including dist/) into /deploy
# along with a flat node_modules containing only production deps.
# --legacy: pnpm 11+ defaults to injected workspace deps, which requires a lockfile
# regenerated with injectWorkspacePackages set; --legacy keeps the prior deploy behavior
# without touching the (shared, monorepo-wide) lockfile.
RUN pnpm deploy --filter backend --prod --legacy /deploy

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# node_modules from pnpm deploy (flat, prod-only, workspace packages bundled)
COPY --from=builder /deploy/node_modules ./node_modules
# Compiled NestJS output
COPY --from=builder /deploy/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
