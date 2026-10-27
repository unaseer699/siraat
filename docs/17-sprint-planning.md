# SIRAAT — PHASE 13: SPRINT / CAPABILITY PLANNING

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

## Roadmap Status (as of Phase 13 kickoff)

| Phase | Document | Status |
|---|---|---|
| 1 | Business Domain Model | ✅ Frozen (+2 addenda) |
| 2 | Bounded Contexts (DDD) | ✅ Frozen |
| 3 | Knowledge Graph | ✅ Frozen |
| 4 | Data Strategy | ✅ Frozen |
| 5 | AI Agent Architecture | ✅ Frozen (+2 addenda) |
| 6 | Database Schema | ✅ Frozen |
| 7 | Microservices | ✅ Frozen |
| 8 | Event-Driven Architecture | ✅ Frozen |
| 9 | Security & IAM | ✅ Frozen |
| 10 | DevOps & Cloud Infrastructure | ✅ Frozen |
| 11 | API Contracts | ✅ Frozen (+1 addendum) |
| 12 | PRDs | ✅ Frozen (unanimous) |
| 13 | Sprint / Capability Planning | ✅ Frozen (this document) |
| 14 | Implementation | 🔶 In progress — Capabilities 1–5 built; Capability 6 (Launch) pending data cutover and founder sign-off. See "Implementation Status" at the end of this document. |

---

## Operating Model (locked)

```
Builder:     Claude Code — full-stack implementation, architecture
             execution, feature development
Founder:     Product direction, deployment/DevOps, CI/CD, hosting,
             infrastructure, environment/secrets management
Constraint:  Review/iteration speed + deployment cadence — not raw
             coding hours
Data clock (Phase 4) vs. Code clock (this phase): run in PARALLEL.
             Early capabilities build/test against a small seed set
             (2-3 manually-verified societies) while full MVTD
             verification (30-35 societies) continues independently.
```

Tech stack (resolved, Conflict 2 of the Engineering Foundation decision):
```
Backend:   Node.js / TypeScript — NestJS + Fastify
Frontend:  Next.js / React — TypeScript
Repo:      Single monorepo (pnpm workspaces)
Local dev: Docker Compose — Postgres, Redis, MinIO (S3 stand-in)
Prod:      Vercel (frontend) + Cloudways (backend) — founder decision,
           see Addendum 4 in 16-addenda.md. Phase 10's DigitalOcean
           spec is not the launch stack.
```

---

## Capability-Based Restructure (replaces screen-based sprints)

> "Every screen answers one question" (Phase 12) →
> "Every sprint/capability answers one business question" (Phase 13)

### Dependency Map
```
Screen 1 (Home) ──┐
Screen 2 (AI Search) ──┴──▶ Screen 3 (Recommendation Results)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        Screen 4 (Rec. Details) Screen 5 (Society) Screen 7 (Property)
                    │               │
                    ▼               ▼
        Screen 9 (Evidence Drawer) Screen 6 (Builder Profile)
                                    │
                                    ▼
                         Screen 10 (Submit Evidence)
```
Construction Estimate (Screen 8) deferred to v1.1 per Phase 12 — excluded from MVP capability plan.

### The Six Capabilities

| # | Name | Question | Screens | Primary APIs |
|---|---|---|---|---|
| 1 | **UNDERSTAND** | Can Siraat understand the user? | Home, AI Search | `POST /v1/market-intelligence/recommendations` |
| 2 | **RECOMMEND** | Can Siraat justify its recommendation? | Rec. Results, Rec. Details | same endpoint, full response shape |
| 3 | **TRUST** | Can users verify everything? | Society, Property, Builder Profile, Evidence Drawer | `GET /v1/trust/societies/{id}/noc-status`, `GET /v1/trust/developers/{id}/verification`, `GET /v1/property-intelligence/properties/{id}`, `GET /v1/trust/evidence/{id}` |
| 4 | **CONTRIBUTE** | Can users improve Siraat? | Submit Evidence | `POST /v1/trust/evidence-submissions` |
| 5 | **OPERATE** | Can Siraat run reliably? | (cross-cutting) | Auth enforcement, rate limiting, DLQ handling, monitoring |
| 6 | **LAUNCH** | Can we go live? | (cross-cutting) | Full MVTD cutover (30-35 societies), production deploy |

### Definition of Done (every capability, non-negotiable)
```
✅ Matches frozen Phase 11 API contract exactly (route, schema, fields)
✅ Score/Recommendation responses carry confidence_score (0.0-1.0 scale),
   is_stale, staleness_threshold_days, affiliation_disclosure
   (required key, nullable value)
✅ DEGRADED_SUCCESS and NOT_COVERED states manually tested, not just FULL
✅ No cross-context foreign keys; no cross-schema transactions
✅ Authorization header present on every route (enforced from
   Capability 5 onward, accepted-not-enforced before that)
✅ Deployed to staging, founder-reviewed
```

---

## Siraat Capability Review (SCR) — Lightweight Governance

```
After each capability, a quick pass (not a formal document cycle):
  [ ] FOUNDER CHECK: Does this deliver usable product value?
  [ ] CPO LENS: Is it intuitive and trust-first (Product Law #2)?
  [ ] CTO LENS: Does it match the frozen API/architecture exactly?
  [ ] RESEARCH CHIEF LENS: Do all standing architectural laws hold?

All "yes" → capability frozen, move to next.
Any "no" → escalate to a real discussion.
```

---

## CAPABILITY 1 — UNDERSTAND: Claude Code Handoff Brief

```
================================================================================
CLAUDE CODE HANDOFF BRIEF: FOUNDATION + CAPABILITY 1 (UNDERSTAND)
================================================================================

PROJECT SETUP:
1. Monorepo: pnpm workspace with apps/backend (NestJS), apps/frontend
   (Next.js), packages/shared-types, packages/config.
2. Docker Compose: Postgres (6 isolated schemas per Phase 6), Redis,
   MinIO — already provisioned via docker/docker-compose.yml and
   docker/init-schemas.sql.
3. Seed data: 2-3 manually verified societies (e.g., CDA Sector F-10,
   Park View City ISB).

CAPABILITY 1 OBJECTIVE:
Implement natural language search & intent extraction.
Route: POST /v1/market-intelligence/recommendations

ARCHITECTURAL INVARIANTS:
- Bounded context: market_intelligence schema only for this capability
- Zero FKs to other context schemas — UUID string references only
- Authorization: Bearer <token> header ACCEPTED, not yet enforced
  (enforcement activates in Capability 5)

REQUEST SCHEMA:
{
  "query_text": "10 Marla plot in Islamabad under 2.5 Crore",
  "filters": {
    "city": "Islamabad",
    "max_price": 25000000,
    "min_price": null,
    "property_type": "PLOT"
  }
}

RESPONSE SCHEMA (Phase 11 parity — confidence_score is 0.0-1.0, NOT 0-100):
{
  "state": "FULL",
  "recommendations": [
    {
      "id": "rec_uuid_001",
      "title": "10 Marla Residential Plot",
      "society_id": "soc_uuid_101",
      "society_name": "Park View City",
      "price": 24000000,
      "confidence_score": 0.915,
      "is_stale": false,
      "staleness_threshold_days": 30,
      "affiliation_disclosure": null,
      "recommendation_summary": "NOC-approved by CDA with high development density.",
      "derived_from": ["doc_noc_789"]
    }
  ]
}

DEFINITION OF DONE:
[ ] Monorepo & local Docker environment running
[ ] User can type a query on Frontend (Screen 1/2)
[ ] Backend parses intent, calls POST /v1/market-intelligence/recommendations
[ ] Response matches schema exactly, confidence_score on 0.0-1.0 scale
[ ] Authorization header accepted (not enforced)
[ ] NOT_COVERED correctly returned for non-seeded regions (e.g. "Lahore")
[ ] Deployed to staging, ready for Founder SCR pass
================================================================================
```

---

## Forward Note for Capability 3

Docker Compose currently provisions all six context schemas up front
(see `docker/init-schemas.sql`), so no additional schema provisioning
is required when Capability 3 (Trust) begins — the `trust` schema
already exists and is ready to use.

---

## Implementation Status (updated 2026-10-27)

> The frozen sections above are unchanged. This section records what has
> actually been built since, so the document no longer reads as if only
> Capability 1 exists. Review items deferred from each capability live in
> `REVIEW_BACKLOG.md`.

### The six capabilities

| # | Name | Status |
|---|---|---|
| 1 | UNDERSTAND | ✅ Built (search, intent parsing, NOT_COVERED) |
| 2 | RECOMMEND | ✅ Built (recommendations, details, trust score) |
| 3 | TRUST | ✅ Built (society, developer, contractor and supplier verification, evidence) |
| 4 | CONTRIBUTE | ✅ Built (evidence submission, NOT_COVERED demand logging) |
| 5 | OPERATE | ✅ Built (shared-key auth guard, rate limiting, score reuse). Per-user OBO auth is deferred: backlog item 9 |
| 6 | LAUNCH | 🔶 Deployment guide and review findings recorded. Still open: the full MVTD cutover (30–35 verified societies) and founder sign-off |

### Built beyond the six capabilities

- **Directories:** contractors (with portfolios and contractor upload links), suppliers (categories, multiple phones, address and map link, name search), house plans.
- **Plots:** daily dealer listings ingested from WhatsApp, Available Plots page (city, society, size and price filters), listing alerts, and a live-plots fallback on the home search when no verified society matches.
- **Construction intelligence:** BOQ estimator (material consumption per area), whole-house estimate, daily market rates, project cost tracker (immutable expense ledger, bills and invoices, cost report with PDF, admin soft delete), project forecast, and the public Real builds pages.
- **Ground-condition reports** from owners and builders, with a review queue.
- **WhatsApp:** expense lists with confirm/cancel, plot listing forwarding, market rates, ground reports, and "Ask Siraat" buttons across the site.
- **Premium live project (self-serve):** a user starts their own project from WhatsApp.
  - Commands: `New Project: <name>`, expense lists, a bill photo or PDF, `REPORT` (private cost-report link), `SHARE` then `SHARE YES`, `UNSHARE`, `DONE`, `REOPEN`.
  - Plans: free trial of 25 saved expenses and one project, then paid. Managed on the admin "WhatsApp Plans" page. Numbers on `WHATSAPP_ADMIN_NUMBERS` and numbers linked by hand are never limited.
  - The report link is the project id (an unguessable UUID); it cannot be revoked. Real per-user login (backlog item 9) is the proper fix.

### Operations notes

- **Hosting:** frontend on Vercel, backend on Cloudways (Addendum 4). Redeploys are triggered by the founder after each push. `docs/DEPLOYMENT.md` is the runbook for this stack.
- **Migrations:** applied by hand, in order, from `docker/migrations/` (001 to 027), one statement at a time. All use `IF NOT EXISTS`, so a rerun is safe. There is no migration runner yet (backlog item 10).
- **Backend settings used by recent work:** `ANTHROPIC_API_KEY` (smart expense reader), `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ADMIN_NUMBERS`, `PUBLIC_SITE_URL` (links sent on WhatsApp), `FRONTEND_URL` (CORS).
- **Known data rule:** society `min_price` / `max_price` are stored in PKR, not Lakh. A value below 100,000 is almost certainly a unit mistake.

### Open items

- Complete the MVTD cutover and take Capability 6 through its review.
- Per-user authentication (backlog item 9, High).
- Startup check that database schemas exist (backlog item 10, Medium).
- Generalise evidence submission beyond societies (backlog item 16, Medium).
- Remaining Low items are listed in `REVIEW_BACKLOG.md`.
