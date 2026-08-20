# SIRAAT — Review Backlog

Tracks items flagged during Siraat Capability Reviews (SCR) that are
**not blocking** for the capability they were found in, but should be
addressed later — either in a specific future capability, or as
general cleanup. Nothing here blocks a freeze; everything here was
explicitly reviewed and consciously deferred, not missed.

Update this file at the end of every SCR pass. Mark items `[x]` when resolved,
noting which capability/commit closed them.

---

## Format

Each item: **Priority** (Low / Medium / High) · **Found in** (capability) ·
**Target** (capability expected to address it, or "General") · Description.

---

## Open Items

### 1. GIN index on `property_types` never actually applied — ✅ RESOLVED (Capability 5)
- **Priority:** Low
- **Found in:** Capability 1
- **Target:** Capability 5 (Operate) — **CLOSED**
- Migration SQL created at `docker/migrations/001_gin_index_societies_property_types.sql`.
  Apply once manually: `psql -U siraat -d siraat -f docker/migrations/001_gin_index_societies_property_types.sql`
  Document: init-schemas.sql only runs on first Docker volume creation; new migrations
  go in `docker/migrations/` and must be applied manually until a migration tool is introduced.

### 2. `DEGRADED_SUCCESS` response has redundant top-level confidence fields — ✅ RESOLVED (Capability 5)
- **Priority:** Low
- **Found in:** Capability 1
- **Target:** Capability 5 — **CLOSED**
- Top-level `confidence_score`/`is_stale`/`staleness_threshold_days`/`affiliation_disclosure`
  are now omitted when `recommendations[]` is non-empty. Per-item fields are authoritative.
  These fields are still sent (and required by schema) when `recommendations: []` to explain
  why nothing matched. Shared-types Zod schema updated to make these fields optional on DEGRADED_SUCCESS.

### 3. `Score.id` doubles as `Recommendation.id`
- **Priority:** Low
- **Found in:** Capability 2
- **Target:** Post-MVP, whenever `recommendation_type` variance is introduced
- Per the frozen Domain Model, Score and Recommendation are meant to be
  separate GENERATED entities (Recommendation references Score via
  `score_ref`). Collapsing them into one ID is a reasonable MVP
  simplification since there's currently only one recommendation type.
  Revisit if/when a Score ever needs to back more than one kind of
  recommendation (e.g., investment framing vs. construction framing).

### 4. Score recomputed and inserted fresh on every search request — ✅ RESOLVED (Capability 5)
- **Priority:** Medium
- **Found in:** Capability 2
- **Target:** Capability 5 — **CLOSED**
- `ScoringService.computeAndSave()` now checks for an existing non-stale Score within
  the staleness window before computing. If found, returns it directly without a new insert.
  Three new tests confirm the reuse logic and edge cases.

### 5. Staleness penalty is a hardcoded inline value — ✅ RESOLVED (Capability 5)
- **Priority:** Low
- **Found in:** Capability 2
- **Target:** Capability 5 — **CLOSED**
- Extracted to `STALENESS_CONFIDENCE_PENALTY = 0.15` constant at the top of
  `scoring.service.ts` with a comment noting it's a tunable business value.

### 6. `NotCoveredRequest` demand-signal logging not yet implemented
- **Priority:** Medium
- **Found in:** Capability 1 (planned, deferred at the time)
- **Target:** Capability 4 (CONTRIBUTE)
- Per the Phase 11 addendum, every `NOT_COVERED` response should log a
  `NotCoveredRequest` entity (location queried, timestamp, requesting
  user) so `demand_count` becomes real instead of always `null`, and
  so expansion planning has actual data behind it. Correctly belongs
  to Capability 4, not earlier — noting it here so it isn't forgotten.

---

### 8. Em-dash renders as "???" in Evidence descriptions
- **Priority:** Low
- **Found in:** Capability 3 (post-freeze fix pass)
- **Target:** General cleanup
- On the Recommendation Details page, resolved Evidence descriptions
  show "???" where a dash character should appear (e.g. "CDA Portal
  ??? NOC No. CDA/D-16/2021/PVC" instead of "CDA Portal — NOC No.
  CDA/D-16/2021/PVC"). Likely a character encoding issue with the
  em-dash/en-dash in source_ref text — check scripts/seed-trust.sql
  encoding and/or how the evidence description is rendered in
  RecommendationDetails.tsx. Cosmetic only, does not affect data
  correctness or scoring.

### 7. Redundant NOC columns on `Society` — scheduled for removal
- **Priority:** Low
- **Found in:** Capability 3
- **Target:** General (any capability post-Capability 3)
- `societies` table still carries `noc_approved`, `noc_summary`, and `source_document_ids`
  columns from Capability 1. These were the source of truth for NOC status until Capability 3
  introduced real `Verification` + `Evidence` records in the `trust` schema.
  `ScoringService` now reads from `TrustService` instead; `noc_summary` is still used in
  `buildReasoning` as a human-readable label but not for confidence calculation.
  Cleanup: drop `source_document_ids` from `societies` once all callers confirmed migrated;
  keep `noc_approved` and `noc_summary` until Society Profile UX is confirmed to pull
  exclusively from Trust endpoints. Do NOT remove in this capability — would break existing
  Capability 1/2 tests and recommendations flow.

---

### 10. Production database schema setup has no automated safety net
- **Priority:** Medium
- **Found in:** Capability 6
- **Target:** Future DevOps hardening
- `init-schemas.sql` must be run manually against a fresh DO database before first boot,
  per `docs/DEPLOYMENT.md`. No automated check confirms this happened before the app starts
  accepting traffic. A startup guard (e.g. verifying that the `trust` schema exists before
  `TypeOrmModule` connects, or a pre-flight migration runner) would prevent silent failures
  where the app boots against an uninitialized database and all requests 500.

### 11. Evidence-required invariant duplicated across `createVerification()` and `promoteToVerified()`
- **Priority:** Low
- **Found in:** Capability 6
- **Target:** General cleanup
- Both methods independently check `evidence_refs.length === 0` and throw
  `BadRequestException`. Extract to a shared `assertHasEvidence()` private helper so the
  rule has one home and any future change to the invariant (e.g. minimum 2 evidence items)
  only needs to be made in one place.

### 9. Full OBO / user-level authentication
- **Priority:** High
- **Found in:** Capability 5
- **Target:** Future capability — requires Identity/User system first
- `BearerGuard` currently validates a single shared API key (`SIRAAT_API_KEY` env var).
  This is a deliberate scope reduction from Phase 9's OBO design — no User/Identity system
  exists yet. Full per-user auth requires an Identity context (user registration, token issuance,
  on-behalf-of token validation). Do not implement piecemeal; implement holistically once
  the Identity capability is defined.

### 15. apiFetch doesn't surface HTTP status codes to callers
- **Priority:** Low
- **Found in:** Developer Profile (frontend chunk 2)
- **Target:** General cleanup
- Every independent optional-data fetch (Society score, Developer stats, etc.)
  currently catches all failures generically and degrades to null/unavailable —
  a real 404 and a transient 500 produce identical UI messaging. If ever worth
  improving, this should be a single change to apiFetch surfacing status codes,
  applied consistently across all callers at once, not a per-page fix.

### 16. Evidence submission (Contribute flywheel) is SOCIETY-only, not CONTRACTOR
- **Priority:** Medium
- **Found in:** Contractor Directory (Chunk 3)
- **Target:** Future capability
- `TrustService.submitEvidence()` and the associated verification-queue flow only support
  `subject_type: 'SOCIETY'`. Contractor profile pages correctly omit the "Help verify this"
  CTA since the backend doesn't support it yet, rather than linking to a broken flow.
  Generalizing `submitEvidence()` to accept `CONTRACTOR` (and by extension `DEVELOPER`) is a
  real, bounded piece of future work — likely small given how cleanly the verification/claim
  system already generalized across all three subject types in this same feature.

### 18. Contractor and Supplier public controller routes have no dedicated controller-level tests
- **Priority:** Low
- **Found in:** Supplier Directory Chunk 3
- **Target:** General cleanup
- Neither `property-intelligence.controller.spec.ts` nor `trust.controller.spec.ts`
  currently cover the Contractor or Supplier public routes (`GET /suppliers`,
  `GET /suppliers/:id`, `GET /trust/suppliers/:id/verification`, and their Contractor
  equivalents) — only the underlying service methods are tested. Society's equivalent
  public routes ARE covered at the controller level. Worth closing this gap for both
  directories together in one pass, matching Society's existing coverage standard.

---

## Resolved Items

| # | Title | Closed in |
|---|-------|-----------|
| 1 | GIN index on `property_types` never applied | Capability 5 |
| 2 | DEGRADED_SUCCESS redundant top-level confidence fields | Capability 5 |
| 4 | Score recomputed fresh on every search | Capability 5 |
| 5 | Staleness penalty hardcoded inline | Capability 5 |
| 6 | NOT_COVERED demand-signal logging | Capability 4 |

---

## How to add a new item

When an SCR pass surfaces something non-blocking, add it here before
moving to the next capability:

```
### N. <short title>
- **Priority:** Low / Medium / High
- **Found in:** Capability X
- **Target:** Capability Y / General
- <description + suggested fix, if known>
```
