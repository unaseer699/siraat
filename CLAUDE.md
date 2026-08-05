# SIRAAT — Claude Code Instructions & Architectural Laws

## 1. CORE OPERATING PRINCIPLES
- You are building Siraat: The Trust Operating System for Real Estate.
- Priority: speed, modularity, clean TypeScript code.
- Strict parity: every API route must match the frozen Phase 11 OpenAPI
  specifications EXACTLY, including field names and types.
- Work one Capability at a time. Do not start the next Capability until
  the current one passes its Definition of Done.

## 2. NON-NEGOTIABLE ARCHITECTURAL INVARIANTS

1. **ZERO CROSS-CONTEXT FOREIGN KEYS.** Tables in `market_intelligence`
   must never have SQL foreign keys referencing `trust`, `identity`, or
   `property_intelligence` tables. Cross-domain references are UUID
   strings only (`society_id`, `owner_ref`, etc.).

2. **NO CROSS-SCHEMA TRANSACTIONS.** A single database transaction must
   never write to more than one context's schema, even within the same
   connection pool.

3. **FACT vs GENERATED.** Every entity carries `record_type: FACT |
   GENERATED`. FACT records are immutable — corrections create new
   records, never overwrite history. GENERATED records always carry
   `derived_from: string[]` pointing to FACT ids and are never used as
   a `source_ref` for anything else.

4. **THREE-STATE RESPONSES MANDATORY.** All recommendation/search
   payloads return `state: "FULL" | "DEGRADED_SUCCESS" | "NOT_COVERED"`.
   Never return a bare 404 for an out-of-coverage query — return
   `NOT_COVERED` with a `demand_count` if applicable.

5. **TRUST TELEMETRY REQUIRED.** Every Score/Recommendation payload
   must include `confidence_score` (number, 0.0–1.0 — NOT 0–100),
   `is_stale` (boolean), `staleness_threshold_days` (number), and
   `affiliation_disclosure` (string | null).

6. **AFFILIATION RULE.** `affiliation_disclosure` is a required key
   but a nullable value. It must be non-null if and only if any entity
   in `derived_from[]` has `is_siraat_affiliated = true`. Affiliation
   must never influence `confidence_score` or scoring inputs.

7. **AUTH.** All API routes accept `Authorization: Bearer <token>`.
   Enforcement (OBO — On-Behalf-Of token validation) activates in
   Capability 5, but the header and plumbing must exist from
   Capability 1 onward. Never bypass a permission check once enforced.

8. **UNTRUSTED DATA TAGGING.** User-submitted evidence and any OCR'd
   document text must be tagged `UNTRUSTED_DATA` and held in a
   verification queue — never auto-promoted to a FACT record without
   human review.

9. **NO GOD CONTEXT.** Do not add logic to one module that reaches
   into another module's schema, internal types, or business rules.
   Cross-module communication is public API calls or events only.

## 3. REPOSITORY LAYOUT
```
siraat/
├── apps/
│   ├── backend/        # NestJS modular monolith
│   └── frontend/       # Next.js / React
├── packages/
│   ├── shared-types/   # OpenAPI-generated types, Zod schemas
│   └── config/         # ESLint, Prettier, TS configs
├── docker/              # docker-compose.yml, init-schemas.sql
├── docs/                 # Phase 1-12 specifications
├── scripts/              # DB seeding, verification tools
└── CLAUDE.md
```

## 4. COMMAND QUICK-REFERENCE
```
Start local infra:   docker compose -f docker/docker-compose.yml up -d
Run backend dev:     pnpm --filter backend dev
Run frontend dev:    pnpm --filter frontend dev
Run tests:           pnpm test
```

## 5. CURRENT CAPABILITY
See `docs/17-sprint-planning.md` for the active capability, its
Definition of Done, and its frozen API contract. Do not proceed past
the current capability's DoD checklist without explicit founder sign-off.

## 6. REVIEW BACKLOG
Non-blocking items deferred from prior capability reviews are tracked
in `REVIEW_BACKLOG.md` at the repo root. Each item records which
capability it is targeted for and why it was deferred.

Capability 5 (OPERATE) should consult `REVIEW_BACKLOG.md` at the start
of that capability — several items are targeted there (rate limiting,
DLQ handling, auth enforcement, monitoring).

Do not fix backlog items outside their targeted capability unless
explicitly asked by the founder. Premature fixes can conflict with
work planned for that capability or introduce untested surface area.
