# Siraat

**The trust operating system for Pakistani real estate.**

Siraat helps people make better property decisions in Pakistan. Instead of another listings portal, it puts
the evidence in front of the buyer: is this society approved, what documents prove it, what has the regulator
said about it, what does it really cost to build, and what is being developed nearby.

Everything Siraat shows is tied to a source, and nothing is promoted to a fact without a human check.

---

## What it does

| Area | What a visitor can do |
|---|---|
| **Check a society** | See approval status and the NOC documents behind it, with a trust score that stays low without verified approval. |
| **Compare societies** | Put two or three societies side by side. |
| **Unapproved schemes** | Search the regulators' own lists of schemes without approval: CDA (Islamabad), RDA (Rawalpindi), LDA (Lahore), PDA (Peshawar), FDA (Faisalabad), MDA (Multan). |
| **Projects & development** | Roads, rail, new cities, housing programmes and tax changes across Pakistan with status, dates and sources. Headlines are picked up daily at 08:00 Pakistan time from news outlets and government press releases. Also lists the affordable schemes approved by PHATA. |
| **Plots for sale** | Browse listings from dealers, including alerts from WhatsApp. |
| **Build cost** | Estimate a house build (BOQ of materials and works) from area, floors and finish level, priced from market rates. |
| **Project cost tracker** | Owners record expenses on their build through WhatsApp or the web, with bills and progress. Opt-in "Real builds" shows what real houses cost. |
| **Directories** | Contractors, suppliers and house plans. |
| **Ground reports** | Report what was found underground or on site. |

## Principles

These are built into the code, not just the policy:

- **Facts are immutable.** A correction creates a new record. History is never overwritten.
- **Generated is not fact.** Computed records always point back to the facts they came from.
- **Human review.** User submissions and any scanned or OCR text are held as untrusted data until a person reviews them.
- **Honest states.** Searches return `FULL`, `DEGRADED_SUCCESS` or `NOT_COVERED`. Never a bare 404 for something we do not cover.
- **Trust telemetry on every score:** `confidence_score` (0.0 to 1.0), `is_stale`, `staleness_threshold_days` and `affiliation_disclosure`.
- **No hidden affiliation.** If Siraat is affiliated with an entity, that is disclosed and never changes a score.
- **Information, not advice.** Siraat is a source finder. Buyers verify with the authority before they invest.

The full list of architectural laws is in [`CLAUDE.md`](CLAUDE.md) and
[`docs/15-standing-architectural-laws.md`](docs/15-standing-architectural-laws.md).

## Repository layout

```
siraat/
├── apps/
│   ├── backend/          NestJS modular monolith (Fastify, TypeORM, PostgreSQL)
│   └── frontend/         Next.js 14 / React 18
├── packages/
│   ├── shared-types/     Zod schemas and TypeScript types shared by both apps
│   └── config/           ESLint, Prettier and TypeScript configs
├── docker/               docker-compose.yml, init-schemas.sql, migrations/ (SQL, applied by hand)
├── docs/                 Product and architecture documentation (Phases 1 to 13)
├── scripts/              Data seeds (SQL) and the QA smoke test
├── CLAUDE.md             Working rules and architectural invariants
└── REVIEW_BACKLOG.md     Deferred review items and the capability each targets
```

### Backend modules

| Module | Responsibility |
|---|---|
| `property-intelligence` | Societies, candidates, illegal schemes, listings, directories |
| `trust` | Evidence, verifications and the verification queue |
| `market-intelligence` | Scores, recommendations, platform stats |
| `construction-intelligence` | BOQ estimator, market rates, project cost tracker, forecast |
| `public-projects` | Government developments, status history, daily news pickup |
| `whatsapp` | Webhook, parsing, replies, listing alerts |
| `ground-reports`, `contractor-portfolio`, `admin`, `auth` | Supporting features |

Each bounded context owns its own PostgreSQL schema. There are **no foreign keys across contexts**
(cross-context references are UUID strings) and **no transaction writes to more than one schema**.
Modules talk through public service calls only.

## Tech stack

- **Frontend:** Next.js 14, React 18, TypeScript. Hosted on Vercel.
- **Backend:** NestJS 10 on Fastify, TypeORM, PostgreSQL. Hosted on Cloudways.
- **Storage:** S3-compatible private bucket for evidence, bills and drawings.
- **AI:** Anthropic Claude for reading WhatsApp expense messages, bills and house layouts.
- **Messaging:** WhatsApp Business Cloud API (Meta).
- **Monorepo:** pnpm workspaces.

## Getting started

Requirements: a current Node.js LTS, pnpm 11, Docker.

```bash
pnpm install

# Local infrastructure: PostgreSQL, Redis, MinIO (S3-compatible)
docker compose -f docker/docker-compose.yml up -d

# Backend: copy the example environment file and fill in the values
cp apps/backend/.env.example apps/backend/.env

# Run both apps
pnpm --filter backend dev       # API on the configured PORT
pnpm --filter frontend dev      # http://localhost:3000
```

The frontend needs `NEXT_PUBLIC_API_URL` (the backend URL) and `SIRAAT_API_KEY` (the same shared key the
backend uses). See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for every environment variable.

`packages/shared-types` is consumed from its built output, so rebuild it after changing a type:

```bash
pnpm --filter shared-types build
```

### Commands

| Command | What it does |
|---|---|
| `pnpm test` | Run all tests |
| `pnpm build` | Build every package |
| `pnpm lint` | Lint every package |
| `pnpm smoke` | Run the QA smoke test in `scripts/` |
| `pnpm --filter backend exec tsc --noEmit -p .` | Type-check the backend |
| `pnpm --filter frontend exec tsc --noEmit` | Type-check the frontend |

## Database

There is no migration runner yet. Schema changes and data seeds are SQL files applied **by hand,
one statement at a time**, in numeric order.

1. On a new database, run `docker/init-schemas.sql` to create the schemas.
2. Apply every file in `docker/migrations/` in order. Each is safe to run twice.
3. Load data with the files in `scripts/` (`seed-*.sql`): societies, NOC evidence, and regulator lists for each authority.

On startup the backend checks that the schemas and recent migrations exist and logs a clear error for any that are missing.

## Data sources

Regulator data comes from each authority's own published lists and is stored with its source link and the
date it was read. Today that covers CDA, RDA, LDA, PDA, FDA and MDA (approved and unapproved lists where
published) and PHATA's approved affordable schemes.

The Projects & development section also reads public RSS feeds from Pakistani news outlets and the
government's press-release page once a day. Only the headline, link and date are stored, never the article text.

## Deployment

Pushing to `main` does not deploy by itself. The founder redeploys the backend on Cloudways and the
frontend on Vercel after a push, applying any new SQL first. The full runbook, including environment
variables and the WhatsApp webhook setup, is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentation

Start at [`docs/00-index.md`](docs/00-index.md). The product vision is in `docs/01-product-vision.md`, the
standing laws in `docs/15-standing-architectural-laws.md`, and the current build plan in
`docs/17-sprint-planning.md`.

## Working on Siraat

- Follow the architectural laws in `CLAUDE.md`. They are not suggestions.
- Match the frozen API contracts exactly, including field names and types.
- Work one capability at a time and finish its definition of done before starting the next.
- Deferred items live in `REVIEW_BACKLOG.md`. Do not fix them outside the capability they target unless asked.
- Never commit secrets. Keys and tokens belong in environment settings, not in the repository.

## Status

Under active development. Siraat is pre-launch and the data is being built up city by city.

## License

No license has been chosen yet. Until one is added, all rights are reserved.
