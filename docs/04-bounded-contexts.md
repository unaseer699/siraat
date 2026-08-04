# SIRAAT — PHASE 2 — BOUNDED CONTEXTS / DDD (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 4. PHASE 2 — BOUNDED CONTEXTS / DDD (Frozen v1.0)

### Founding Decision
Rejected a monolithic "Knowledge Context." Adopted domain-first, business-capability-driven design.

### The Six Bounded Contexts

| Context | Owns (FACT) | Rate of Change |
|---|---|---|
| **Identity** | User, Roles, Organizations, Auth | Low |
| **Data Acquisition** | Raw facts, provenance, licensing | Very high |
| **Property Intelligence** | Property, Society, Location, Developer (identity) | Mixed |
| **Trust** | Verification, Evidence, Developer (verification), Legal Docs | Low-moderate |
| **Construction Intelligence** | Construction Estimate, Material | Mixed |
| **Market Intelligence** | Nothing (FACT) — GENERATED only: Score, Recommendation | Fast recompute, slow rule change |

### Architectural Laws Established (binding on all future phases)
1. **No God Context**
2. **GENERATED never becomes FACT**
3. **Event-First Communication** — no direct DB reads or internal-logic calls across contexts
4. **Dependency Rule** — dependencies point inward only, never sideways into internals
5. **Anti-Corruption Layer** — every context translates incoming facts into its own bounded model

### Ownership Resolutions
- Developer split: identity → Property Intelligence; verification → Trust
- Observation owned by originating context, not Market Intelligence
- Legal Documents owned by Trust
- Location: no separate context, owned by Property Intelligence
- Recommendation's User Intent dependency: acknowledged, deferred to Phase 5

### Validation
Independent-Deployability Stress Test — all six contexts passed. Key finding: bounded context ≠ deployable service (Property Intelligence and Construction Intelligence show internal rate-of-change divergence — resolved in Phase 7).

---
