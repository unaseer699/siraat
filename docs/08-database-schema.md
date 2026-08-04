# SIRAAT — PHASE 6 — DATABASE SCHEMA / DATA ARCHITECTURE (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 8. PHASE 6 — DATABASE SCHEMA / DATA ARCHITECTURE (Frozen v1.0)

### The Nine Laws of Siraat Data Architecture (canonical for Phase 6)
```
1. Each bounded context owns its own logical schema.
2. No cross-context foreign keys — UUID references only.
3. Communication only through APIs and Domain Events.
4. FACT is immutable. GENERATED is reproducible.
5. Current state = Snapshot table. History = append-only Delta Ledger
   — applied at BOTH context level AND Knowledge Graph projection level
   (this resolves Phase 3's deferred temporal-query requirement).
6. Knowledge Graph is projection only. Never authoritative.
7. Observation is append-only, partitioned by time. Never overwritten.
8. Every Score has an explicit staleness_threshold (TTL).
9. Every schema must be independently deployable — shared infra
   today, no redesign required tomorrow.
```
*(Distinct from the 13 cross-phase architectural principles — kept as separate numbered lists to avoid future ambiguity.)*

### Storage Topology
Shared physical cluster at launch; logical schema isolation per context (`identity.*`, `trust.*`, `property_intelligence.*`, `construction_intelligence.*`, `market_intelligence.*`) — zero cross-schema foreign keys.

### Temporal Architecture — Resolved
Rejected: full event replay (too slow), pure bi-temporal tables (unnecessary complexity at MVTD scale).
**Adopted: Hybrid Snapshot + Delta Ledger**, applied at both the context layer (Score, Observation) and the Knowledge Graph Projection layer (using `event_timestamp`/`projection_version`) — giving the Graph itself genuine "as of T" relationship traversal, not just per-entity history.

### Observation Growth Strategy
Partitioned by `(context_id, RANGE(valid_from))`. Hot tier ≤12 months; warm/cold >12 months — retained permanently, never deleted.

### Score Staleness Thresholds (resolves the original Phase 1 open item)

| Score Subtype | TTL |
|---|---|
| Construction Cost Index | 7 days |
| Property Valuation | 14 days |
| Society Risk Score | 30 days |
| Developer Score | 60 days |

### Data Classification (new this phase)
`Master Data | Reference Data | Transactional Data | Evidence | Observation | Generated Intelligence | Audit | Configuration` — foundation for retention, backup, encryption, indexing policy in later phases.

### Data Lifecycle
`Created → Verified → Published → Projected → Consumed → Archived`

### Resolved Schema Details
- `Evidence.file_ref` — reference pointer only, never inline blob
- Construction Intelligence schema reserves `extended_attributes` for future SCOS entities without breaking migration
- `is_siraat_affiliated` confirmed structurally isolated from Score's `inputs[]`

### Full Field-Level Schema (as drafted, by context)
- **Identity:** User (id, roles[], organization_ref, status), Organization
- **Data Acquisition:** Data Source (id, tier, origin, transformation_history, license, reliability_score, refresh_frequency)
- **Property Intelligence:** Property (Snapshot+Ledger), Society (Snapshot+Ledger, includes `is_siraat_affiliated`), Location (Snapshot only), Developer profile (Snapshot only)
- **Trust:** Verification (Snapshot+Ledger, requires ≥1 evidence_refs), Evidence (Snapshot only, immutable), Legal Document (Snapshot only)
- **Construction Intelligence:** Construction Estimate (with `extended_attributes` reserved), Material (Snapshot+Ledger, partitioned)
- **Market Intelligence:** Score (Snapshot+Ledger, includes `is_stale` computed field), Recommendation (no ledger — regenerated on demand)
- **Knowledge Graph Projection (platform capability, not a context):** Node table, Edge table, Graph Delta Ledger — all carrying full provenance
- **Observation:** shared logical shape, physically partitioned per owning context

---
