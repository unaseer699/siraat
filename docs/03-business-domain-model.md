# SIRAAT — PHASE 1 — CANONICAL BUSINESS DOMAIN MODEL (Frozen v1.0, +2 addenda)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 3. PHASE 1 — CANONICAL BUSINESS DOMAIN MODEL (Frozen v1.0, +2 addenda)

### Founding Principle
> **Siraat stores facts. Siraat generates opinions from facts.**

Enforced via `record_type: FACT | GENERATED` on every entity.
- **FACT:** immutable once written, `source_ref` + date required, corrections create new records.
- **GENERATED:** always carries `derived_from[]` pointing to FACT IDs, fully regenerable, never itself usable as a `source_ref`. **No GENERATED artifact may ever become a canonical FACT input elsewhere** (no recursive intelligence, no scoring-on-scores).

### Domain Structure

**Core Domain:**

| Entity | Type | Key Notes |
|---|---|---|
| User | FACT | Single identity, multiple roles |
| Property | FACT | `owner_ref` added via addendum (§16) |
| Society | FACT | NOC status, possession history, complaint count — the MVP wedge |
| Developer | FACT (lightweight) | Identity/profile only; verification owned by Trust |
| Evidence | FACT | Citable artifact linked to claims |
| Verification | FACT | Requires ≥1 linked Evidence |
| Data Source | FACT | Tier 1/2/3, provenance, lineage — **the core moat** |
| Observation | FACT | Historical snapshot — elevated to Core, feeds longitudinal moat |
| Score | GENERATED | Unified model for all subtypes (Society/Developer/Property/Investment/Construction/Risk) |
| Recommendation | GENERATED | Structured reasoning, never a free-text transcript |

**Supporting Domain (modeled, minimal):** Construction Estimate, Material, Location, Legal Document

**Future Domain (named, not modeled):** Contractor, Supplier, Marketplace, Financial Product, Project, Investor Org, Builder Org, Enterprise Roles

### Key Decisions
- **Revenue model:** B2C free + premium subscription (PKR 2,000–5,000/mo; reports PKR 5,000–25,000); B2B dashboards (PKR 50k–500k/mo); marketplace commissions (3–10%); long-term data licensing.
- **Who owns truth:** Siraat does not own absolute truth — it owns a confidence-based Intelligence Layer, never bare assertions.
- **Regulatory posture:** Not a legal/financial advisor or property agent — checklists and risk indicators only, never certifications.
- **User identity:** Single identity, multiple roles.
- **AI Insight rejected** as a standalone entity — folded into Recommendation.
- **Risk Score + Trust Score unified** into one Score concept.

### Biggest Moat (established here, reconfirmed every phase since)
NOT copyable: chat UX, search, marketplace, calculators.
IS the moat: proprietary data + provenance + longitudinal scoring history + explainability + continuous learning from verified outcomes.

### Open items carried forward (still open at time of this document)
- Verification data-sourcing pipeline (operational detail)
- Score `staleness_threshold` — **resolved in Phase 6** (see §8)

---
