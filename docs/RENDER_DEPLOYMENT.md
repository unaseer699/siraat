# Siraat Backend — Render + Neon Deployment

This covers deploying the backend to **Render** (free tier) with **Neon** as the
production Postgres database. This is the active deployment path; `.do/app.yaml`
and `docs/DEPLOYMENT.md` describe an earlier DigitalOcean App Platform path that
is not currently used but is left in place for reference.

---

## 1. Environment Variables

Set these in the **Render dashboard → siraat-backend → Environment** tab. `render.yaml`
declares the keys (`sync: false`) but never their values — Render prompts for each on
first deploy.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon connection string, from the Neon dashboard. Must include `sslmode=require` (Neon includes this by default). No extra SSL config is needed in code — confirmed by a live connection test against Neon; pg's own connection-string parsing already upgrades `sslmode=require` to a verified TLS connection. |
| `REDIS_URL` | Placeholder — the throttler is in-memory today. Any valid Redis URL or dummy value until Redis is actually wired in. |
| `SIRAAT_API_KEY` | Shared Bearer token all API clients send. Generate with `openssl rand -hex 32`. Must match the frontend's own `SIRAAT_API_KEY` (server-side only, set in Vercel — the frontend's Next.js proxy route holds this and forwards it to the backend; it is never sent to the browser). |
| `FRONTEND_URL` | The deployed Vercel frontend's origin (e.g. `https://siraat.vercel.app`). Used by `main.ts`'s `app.enableCors` — falls back to `http://localhost:3000` if unset. |
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | From the Meta App Dashboard. |
| `ANTHROPIC_API_KEY` | Used by `WhatsappAiClient`. If unset, parsing degrades gracefully rather than failing. |
| `ANTHROPIC_MODEL` | Set as a plain (non-secret) value in `render.yaml`; override in the dashboard only if changing models. |
| `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` / `S3_REGION` | Object storage credentials (DO Spaces or any S3-compatible provider). |

`NODE_ENV=production` is set directly in `render.yaml` (not a secret).

---

## 2. Neon SSL — what was verified

`app.module.ts`'s `TypeOrmModule.forRoot` passes `url: process.env.DATABASE_URL` straight
through. TypeORM forwards this as `connectionString` to `pg`, and `pg`'s own
connection-string parser reads `sslmode=require` from the URL and negotiates TLS itself —
no `ssl: { rejectUnauthorized: false }` or similar option was needed in code.

This was confirmed with a real connection against the Neon database from `.env.local`
(`select version()` succeeded), not assumed from documentation.

---

## 3. Database Schema Bootstrap (first deploy only)

Neon starts empty, and `synchronize: process.env.NODE_ENV !== 'production'` is correctly
disabled once `NODE_ENV=production`. Before the first real deploy:

1. Run the schema-creation script directly against Neon:
   ```bash
   psql "$DATABASE_URL" -f docker/init-schemas.sql
   ```
2. TypeORM will not auto-create tables with `synchronize` off. Either:
   - **Option A (fresh DB, no real data):** temporarily set `NODE_ENV=development` in the
     Render dashboard, deploy once so TypeORM synchronizes tables, then switch back to
     `production` and redeploy.
   - **Option B:** add a TypeORM migration runner (tracked in `REVIEW_BACKLOG.md`, not yet
     implemented).

---

## 4. Build & Start

Render builds and runs only `apps/backend` out of the pnpm workspace:

- **Build:** `npm install -g pnpm@11.20.0 && pnpm install --frozen-lockfile && pnpm --filter @siraat/shared-types build && pnpm --filter backend build`
  (the backend depends on the workspace package `@siraat/shared-types`, so it must be
  built first; `nest build` for the backend then compiles to `apps/backend/dist`).
- **Start:** `node apps/backend/dist/main.js` (`main.ts`'s NestFactory bootstrap; matches
  the entrypoint the existing `apps/backend/Dockerfile` also runs).
- **Health check:** `GET /health` → `{"status":"ok"}` (`HealthController`, public, no auth).

Root `package.json` pins `"packageManager": "pnpm@11.20.0"`, and the build command installs
that exact version with `npm install -g pnpm@11.20.0` so Render's build matches local.

> **Do not switch this back to `corepack enable`.** Render's Node build image ships pnpm
> pre-installed at a path (`/usr/bin/pnpm`) that is read-only at build time. `corepack enable`
> tries to replace that binary and fails with `EROFS: read-only file system, unlink
> '/usr/bin/pnpm'` — this is a known issue on Render, not a config mistake. pnpm's own current
> guidance has also moved away from recommending Corepack for this reason, favoring a direct
> `npm install -g pnpm` instead.

---

## 5. CORS

`main.ts` calls `app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', ... })`.
Set `FRONTEND_URL` to the deployed Vercel URL so the frontend isn't blocked by CORS —
confirmed this env var is actually read here, not just declared and unused.

---

## 6. Free Tier Note

Render's free web services spin down after 15 minutes of inactivity and cold-start on
the next request (accepted tradeoff for this stage). No code change addresses this.
