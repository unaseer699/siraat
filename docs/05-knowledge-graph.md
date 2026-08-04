# SIRAAT — PHASE 3 — KNOWLEDGE GRAPH, LOGICAL (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 5. PHASE 3 — KNOWLEDGE GRAPH, LOGICAL (Frozen v1.0)

### Central Resolution
Knowledge Graph is a **read-only projection**, never an exception to No God Context — explicitly a **platform capability**, not a seventh context.

### Nine Locked Requirements
1. Projection-only, never authoritative
2. Read-only, no business logic
3. **Graph Identity Rule** — one authoritative owner per node
4. Full provenance on every node/edge
5. `event_timestamp` vs `projected_at` distinction
6. Evidence as thin reference nodes only
7. Platform capability, not a context
8. Temporal querying mandatory as a *logical* capability, mechanism deferred (**resolved in Phase 6**)
9. No business logic ever executes against the graph

### Corrected Ownership Table
User→Identity | Property/Society/Location/Developer(profile)→Property Intelligence | Verification/Evidence/Legal Doc/Developer(verification)→Trust | Construction Estimate/Material→Construction Intelligence | Score/Recommendation→Market Intelligence

### Provenance Contract
```
source_context, owning_context, source_entity_id, source_event_id,
event_timestamp, projected_at, projection_version
```

### Temporal Query Requirement (locked language)
> The Knowledge Graph SHALL support temporal reasoning as a logical capability... The implementation strategy will be defined during the Technology Architecture phase. [Resolved: Phase 6 — Hybrid Snapshot + Delta Ledger, applied at the Graph layer too.]

---
