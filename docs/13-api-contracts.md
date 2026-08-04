# SIRAAT — PHASE 11 — API CONTRACTS (Frozen v1.0, +1 addendum)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 13. PHASE 11 — API CONTRACTS (Frozen v1.0, +1 addendum)

### API Style — Hybrid, Locked
```
Channel A — Bounded Context Public APIs: REST, OpenAPI 3.1
  /v1/{context-name}/... (identity, property-intelligence, trust,
  construction-intelligence, market-intelligence)
Channel B — Knowledge Graph Traversal: GraphQL/Cypher query interface
  Read-only, relationship/path queries — returns entity UUIDs only,
  never authoritative attribute values (enforces Phase 5's tie-break rule)
```
Chosen because modern LLM tool-calling engines parse OpenAPI schemas natively (reduces hallucination risk for the AI Orchestrator), while GraphQL/Cypher is purpose-built for the Graph's actual use case (multi-hop traversal).

### Recommendation Response Schema (corrected during review)
```json
{
  "required": ["recommendation_id","subject_id","recommendation_type",
    "confidence_score","is_stale","staleness_threshold_days",
    "affiliation_disclosure","derived_from"],
  "affiliation_disclosure": {
    "type": ["string","null"],
    "description": "REQUIRED KEY, NULLABLE VALUE. Non-null if and
      only if any entity in derived_from[] has is_siraat_affiliated
      = true. Server-enforced correlation, not client-optional."
  }
}
```
*(Corrected from an earlier draft that would have made disclosure text non-null on every Recommendation — would have forced meaningless boilerplate on the majority of non-affiliated results, undermining the Phase 5 disclosure signal.)*

### Degraded Response Pattern (corrected, all required fields present)
```json
{ "status": "DEGRADED_SUCCESS", "confidence_score": 0.15,
  "is_stale": true, "staleness_threshold_days": 30,
  "affiliation_disclosure": null,
  "missing_evidence": ["NOC_VERIFICATION_RECORD","APPROVED_LAYOUT_PLAN"],
  "derived_from": ["..."] }
```
HTTP 200 — a valid business state (Phase 4), never a 4xx/5xx error.

### Error Model
`403 OBO_PERMISSION_DENIED` (Phase 9) · `400` malformed request · `200 + DEGRADED_SUCCESS` valid-but-low-confidence.

### Headers
`Authorization: Bearer <OBO token>` · `X-Siraat-Country-Code: PK` (matches Phase 7's field, corrected from an over-granular earlier draft) · `X-Siraat-Session-ID`

### Pagination & Rate Limiting
`?limit=<default 25, max 100>&offset=<n>` · default 60 req/min per user, higher for internal Orchestrator service identity.

### Versioning
`/v1/` prefix, aligned to Phase 8's event `schema_version`.

---
