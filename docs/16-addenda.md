# SIRAAT — ALL ADDENDA (Chronological, Additive — None Reopen Their Source Document)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 16. ALL ADDENDA (Chronological, Additive — None Reopen Their Source Document)

**Addendum 1 (Phase 5, on Phase 1's Domain Model):**
`is_siraat_affiliated: boolean` on Developer and Property — mandatory disclosure, never a scoring input, same verification bar as any entity.

**Addendum 2 (Phase 11.0.1, on Phase 11's API Contracts, surfaced during Phase 12):**
```
POST /v1/trust/evidence-submissions — user evidence upload endpoint
NOT_COVERED response state — for locations with no verified record
NotCoveredRequest entity — logs demand signal for expansion planning
Confidence threshold constants — enforced server-side in Market
  Intelligence, not client-side
```

**Addendum 3 (Phase 1.0.2, on Phase 1's Domain Model, surfaced during Phase 12):**
```
Property.owner_ref: UUID → User [nullable]
  Enables "Property Owner" persona/capability without a new
  system Role — reuses Phase 9's existing Owner-scope access
  pattern (no Phase 9 changes required).
```

---

**Addendum 4 (Phase 14, on Phase 10's DevOps & Cloud Infrastructure — founder decision, 2026-10-27):**
```
Launch hosting is Vercel (frontend) + Cloudways (backend), NOT
DigitalOcean App Platform. Phase 10's DigitalOcean specification and
its AWS migration target remain the frozen reference for a later move;
they are not the launch stack.

Frontend:  Vercel (Next.js). Browser calls go through the same-origin
           /api/proxy route, which holds the backend credentials
           server-side.
Backend:   Cloudways (NestJS / Fastify), deployed by the founder after
           each push to main.
Database:  PostgreSQL with the six context schemas (init-schemas.sql).
           Schema changes are applied by hand from docker/migrations/
           (no migration runner yet — REVIEW_BACKLOG item 10).
Storage:   S3-compatible bucket, configured through the S3_* backend
           variables (private, pre-signed URLs, as Phase 10 specified).
CI/CD:     Founder-triggered redeploys. No automatic deploy pipeline.

No architectural law changes: schemas, invariants and API contracts
are unaffected by the hosting choice.
```
