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
# --legacy mode only *symlinks* workspace packages (e.g. @siraat/shared-types) back to
# their source location under /app/packages, which doesn't exist in the runtime stage
# below and breaks at container startup. inject-workspace-packages makes pnpm copy the
# real package contents into /deploy/node_modules instead; passing it as an ad-hoc
# --config flag (rather than persisting it in pnpm-workspace.yaml) applies it only to
# this deploy step, so it doesn't affect `pnpm install --frozen-lockfile` above and
# doesn't require regenerating the shared monorepo lockfile.
RUN pnpm --config.inject-workspace-packages=true deploy --filter backend --prod /deploy

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
