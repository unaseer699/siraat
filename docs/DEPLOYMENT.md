# Siraat — Production Deployment Checklist

This document covers what must be done before and during a first production deploy
to DigitalOcean App Platform. Work through every section in order.

---

## 1. Environment Variables

All secrets are set in the **DO App Platform → App Settings → Environment Variables**
panel, not in `.do/app.yaml`. The `app.yaml` marks them as `type: SECRET` to signal
that DO should prompt for the value; it never stores the value itself.

| Variable | Component | Notes |
|---|---|---|
| `DATABASE_URL` | Backend | Injected automatically by DO when you attach the Managed Postgres database. Verify it starts with `postgres://`. |
| `REDIS_URL` | Backend | Placeholder for future Redis-backed throttler/queue. Set to any valid Redis URL or a dummy value until needed. |
| `SIRAAT_API_KEY` | Backend + Frontend | The shared Bearer token all API clients must send. Generate a strong random string (e.g. `openssl rand -hex 32`). Set the **same value** in both the backend env var and `NEXT_PUBLIC_SIRAAT_API_KEY` (frontend). |
| `NEXT_PUBLIC_API_URL` | Frontend (build-time) | Auto-resolved from the backend component's public URL by DO. No manual action needed. |
| `NEXT_PUBLIC_SIRAAT_API_KEY` | Frontend (build-time) | Must match `SIRAAT_API_KEY`. Baked into the Next.js bundle — any change requires a full frontend rebuild. |
| `FRONTEND_URL` | Backend | Auto-resolved from the frontend component's public URL. Used for CORS. |

---

## 2. Database Migration Strategy

**`synchronize: true` is NOT safe for production.**

The backend currently sets `synchronize: process.env.NODE_ENV !== 'production'`, which
means synchronize is disabled when `NODE_ENV=production`. This is the correct guard.

**Before first deploy:**

1. The DO Managed Postgres database starts empty. You must run schema creation manually:

   ```bash
   # Connect to the DO database from your local machine (get the connection string from DO panel)
   psql $DATABASE_URL -f docker/init-schemas.sql
   ```

   This creates all schemas (`property_intelligence`, `trust`, `market_intelligence`, etc.)
   and the GIN index on `property_types`.

2. On first startup with a fresh database, TypeORM will **not** auto-create tables
   (synchronize is off). Before going live, either:

   **Option A (recommended for early stage):** Temporarily set `NODE_ENV=development` on
   the DO backend component, deploy once, then switch back to `production`. This lets
   TypeORM synchronize the tables on the fresh database exactly once. Then redeploy with
   `production`. This is safe only on a fresh database with no real data.

   **Option B (recommended before real data exists):** Add a TypeORM migration runner.
   The codebase does not yet have migrations — this is a known REVIEW_BACKLOG item
   targeted for a future capability. When implemented, the migration step replaces Option A.

---

## 3. Seed Data

**Production seeding is a manual, human-verified process. It is never automated.**

The scripts in `scripts/seed-*.sql` are for local development only. Do not run them
against the production database — they contain fake data at stable UUIDs, which would
pollute the trust record.

To onboard a real society, use the admin tool:

```bash
pnpm --filter backend exec ts-node \
  -P scripts/tsconfig.scripts.json \
  scripts/admin-add-society.ts
```

Point it at the production database by setting `DATABASE_URL` in your shell before
running. Walk through one society at a time. Evidence must correspond to real documents
that have been manually verified.

---

## 4. Deploy Steps

1. Push code to `main` (or your release branch).
2. In the DO panel: create the app from `.do/app.yaml` (or use `doctl apps create --spec .do/app.yaml`).
3. Set all SECRET env vars in the panel (see Section 1).
4. Attach the Managed Postgres database to the backend component.
5. Run `init-schemas.sql` against the new database (Section 2, step 1).
6. Deploy the backend component. Verify `/health` returns `{"status":"ok"}`.
7. If using Option A above: switch `NODE_ENV` to `development` temporarily, redeploy,
   then switch back to `production` and redeploy again.
8. Deploy the frontend component (needs backend URL for `NEXT_PUBLIC_API_URL`).
9. Run the smoke test against the staging URL to confirm the system is alive:
   ```bash
   SMOKE_BASE=https://your-backend-url.ondigitalocean.app \
   SMOKE_KEY=your-api-key \
   ts-node -P scripts/tsconfig.scripts.json scripts/qa-smoke-test.ts
   ```

---

## 5. DO Spaces (File Storage)

The Evidence Submission flow stores `file_ref` strings but does not yet upload real
files. When file upload is implemented, provision a DO Spaces bucket and wire its
endpoint + access keys to the backend via env vars.

---

## 6. Known Gaps (REVIEW_BACKLOG)

- TypeORM migrations are not yet implemented — synchronize-once is the interim strategy.
- Redis-backed throttler: currently in-memory (resets on redeploy). Suitable for
  single-instance deploys; wire Redis when scaling to multiple instances.
- Full OBO/user-level auth: BearerGuard uses a single shared key. Multi-user auth is
  a future capability.
