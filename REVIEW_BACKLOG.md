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

### 1. GIN index on `property_types` never actually applied
- **Priority:** Low
- **Found in:** Capability 1
- **Target:** General / Capability 5 (Operate)
- `docker/init-schemas.sql` only runs once on first volume creation, and
  the `societies` table didn't exist yet at that point anyway — so the
  GIN index was never actually created against the running database.
  At MVTD scale (30-35 societies) this has zero real performance impact.
  Fix: create the index manually once locally, or via a proper migration
  once a migration tool is introduced:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_societies_property_types
    ON property_intelligence.societies USING GIN (property_types);
  ```

### 2. `DEGRADED_SUCCESS` response has redundant top-level confidence fields
- **Priority:** Low
- **Found in:** Capability 1
- **Target:** Capability 2 cleanup / Capability 3
- When `recommendations[]` is non-empty in a `DEGRADED_SUCCESS` response,
  both per-item `confidence_score`/`is_stale` AND top-level ones are
  populated — redundant. Recommendation: only populate top-level
  confidence/staleness fields when `recommendations: []` (i.e., they
  explain *why nothing matched*); let per-item fields be authoritative
  when items are present.

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

### 4. Score recomputed and inserted fresh on every search request
- **Priority:** Medium
- **Found in:** Capability 2
- **Target:** Capability 5 (Operate)
- No reuse of a recent Score within its `staleness_threshold` — every
  search creates new `Score` rows for every matching society. Fine at
  MVTD volume; will cause unbounded table growth and repeated
  computation cost at real scale. Fix: check for an existing,
  non-stale Score for the same subject before computing a new one.

### 5. Staleness penalty is a hardcoded inline value
- **Priority:** Low
- **Found in:** Capability 2
- **Target:** General cleanup
- `ScoringService.computeConfidence()` subtracts a flat `0.15` for
  stale data, inline in the method. Should become a named constant
  or config value (similar treatment to the Phase 6 staleness TTL
  table) so it's tunable without hunting through logic.

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

## Resolved Items

_(none yet — items move here once closed, with the commit/capability that fixed them)_

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
