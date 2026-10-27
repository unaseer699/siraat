# Siraat — Deployment Runbook (Vercel + Cloudways)

Launch hosting is **Vercel** for the frontend and **Cloudways** for the backend
(Addendum 4 in `16-addenda.md`). Deploys are triggered by the founder after a push to
`main`. The DigitalOcean (`.do/app.yaml`) and Fly (`fly.toml`) files in the repo are not
used.

---

## 1. Environment variables

### Backend (Cloudways application settings)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `SIRAAT_API_KEY` | yes | Shared Bearer key. Must equal the frontend's `SIRAAT_API_KEY`. |
| `FRONTEND_URL` | yes | The Vercel site URL. Used for CORS. |
| `PUBLIC_SITE_URL` | yes | The Vercel site URL. Used for links sent on WhatsApp (report link, Real builds link, alerts). |
| `NODE_ENV` | yes | `production`. Turns TypeORM `synchronize` off. |
| `PORT` | if needed | Port the backend listens on. |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | yes | S3-compatible private bucket (evidence, house plans, bills, drawings). `S3_REGION` is optional. |
| `ANTHROPIC_API_KEY` | yes | Smart expense reader, layout reader. Without a valid key the plain reader is used and sections are not detected. `ANTHROPIC_MODEL` and `ANTHROPIC_LAYOUT_MODEL` are optional overrides. |
| `WHATSAPP_ACCESS_TOKEN` | yes | Use a permanent system-user token; a temporary one expires. |
| `WHATSAPP_PHONE_NUMBER_ID` | yes | |
| `WHATSAPP_VERIFY_TOKEN` | yes | Used for Meta's webhook handshake. |
| `WHATSAPP_APP_SECRET` | yes | Verifies the signature on every webhook call. |
| `WHATSAPP_ADMIN_NUMBERS` | recommended | Comma-separated digits. These numbers can post to any project and are never limited by the free-trial cap. |
| `WHATSAPP_ALERT_TEMPLATE`, `WHATSAPP_ALERT_TEMPLATE_LANG` | for plot alerts | Approved template used outside the 24-hour window. |
| `WHATSAPP_DRAFT_STALE_HOURS`, `WHATSAPP_LISTING_EXPIRY_DAYS`, `LISTING_STALE_DAYS` | optional | Tuning values with defaults. |

### Frontend (Vercel project settings)

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | The backend's public URL (the Cloudways application URL). Build-time. |
| `SIRAAT_API_KEY` | Same value as the backend. Server-side only; never prefix with `NEXT_PUBLIC_`. |
| `ADMIN_PANEL_PASSWORD` | Admin login. |
| `NEXT_PUBLIC_SIRAAT_WHATSAPP` | Optional override of the "Ask Siraat" WhatsApp number (default is set in `lib/siraatContact.ts`). |

### Meta (WhatsApp Cloud API)

- Webhook callback URL: `<backend URL>/v1/webhooks/whatsapp`, with the same verify token as `WHATSAPP_VERIFY_TOKEN`.
- The app must be live (or the recipient added as a test number), otherwise replies fail with error 131030, "Recipient phone number not in allowed list".

---

## 2. Database

Schema changes are applied **by hand**, one statement at a time (Adminer), in this order,
before deploying the backend that needs them. There is no migration runner yet
(REVIEW_BACKLOG item 10).

1. A fresh database first needs the schemas: run `docker/init-schemas.sql`.
2. Apply every file in `docker/migrations/` in numeric order (001 to 027 so far). Each uses
   `IF NOT EXISTS`, so running one again is safe.
3. With `NODE_ENV=production` TypeORM does not create tables. For a brand-new database,
   either run once with `NODE_ENV=development` (fresh, empty database only), then switch
   back, or create the tables from the entity definitions by hand.

**Rule:** run a migration *before* deploying code that reads the new column or table.
For example, migration 026 (supplier phones, address, map link) must exist before the
backend that selects those columns goes live, or supplier pages return errors.

After applying migrations, check them with a query against `information_schema.columns`
(see the verification query in the relevant chat or PR).

---

## 3. Seed data

Production data is entered by humans through the admin screens. The scripts in
`scripts/seed-*.sql` are for local development only: they contain fake data at stable
UUIDs and must never be run against production.

To onboard one real society from the command line (evidence must match real,
manually verified documents):

```bash
pnpm --filter backend exec ts-node \
  -P scripts/tsconfig.scripts.json \
  scripts/admin-add-society.ts
```

Set `DATABASE_URL` in your shell first.

---

## 4. Deploy steps

1. Push to `main`.
2. Run any new migrations from `docker/migrations/` (Section 2).
3. Add or change any backend environment variables (Section 1).
4. Redeploy the backend on Cloudways, then restart it so new variables are read.
   Check `<backend URL>/health` returns `{"status":"ok"}`.
5. Redeploy the frontend on Vercel (it needs `NEXT_PUBLIC_API_URL`).
6. Smoke test:
   ```bash
   SMOKE_BASE=https://<your-backend-url> \
   SMOKE_KEY=<your-api-key> \
   ts-node -P scripts/tsconfig.scripts.json scripts/qa-smoke-test.ts
   ```
7. For WhatsApp changes, send a message from a test number and confirm the reply arrives.

A backend-only change needs no Vercel redeploy, and a frontend-only change needs no backend
redeploy or SQL.

---

## 5. Known gaps (REVIEW_BACKLOG)

- No migration runner and no startup check that the schemas exist (item 10).
- Throttling is in memory and resets on restart. Fine for one instance; wire Redis before running several.
- Auth is one shared key plus the admin password. Per-user login is a future capability (item 9).
- A project's private report link is its id; it cannot be revoked until real user login exists.
