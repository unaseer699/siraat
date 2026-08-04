# SIRAAT — PHASE 12 — PRODUCT REQUIREMENTS (PRDs) (Frozen v1.0, unanimous)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 14. PHASE 12 — PRODUCT REQUIREMENTS (PRDs) (Frozen v1.0, unanimous)

### Product Mission
> Help every Pakistani make real estate decisions with confidence by replacing opinions, marketing, and rumors with verified evidence, transparent reasoning, and explainable AI.

### Product Laws (Frozen)
```
Law #0: Every feature must increase Trust, save Time, or reduce
        Cost — otherwise it does not belong in MVP.
Law #1: Siraat never tries to sell the user. It helps them decide.
Law #2: Every recommendation must answer "Why should I trust this?"
        before "What should I buy?"
Law #3: Unknown is better than fake — never hallucinate, never
        hide uncertainty.
Law #4: Trust grows through transparency — every score, every
        recommendation, every warning must be explainable.
```

### Personas (4, deliberately narrow)
1. **Home Buyer** (primary) — "I purchased confidently"
2. **Investor** — "I invested before everyone else"
3. **Builder/Developer** — "I receive more qualified customers"
4. **Property Owner** (replaces an earlier "Seller" persona — deliberately NOT a new system Role; a capability layered on the existing User + `Property.owner_ref` relationship, reusing Phase 9's existing "Owner (user_id = self)" access pattern — avoids Role Explosion)

### North Star User Journey
```
Need → Discovery → Understanding → Confidence → Decision →
Contribution → Platform becomes smarter → Next user benefits
```

### Three UI States (matches Phase 11 exactly)
```
FULL — high-confidence, complete evidence
DEGRADED_SUCCESS — shown, but confidence reduced, missing
  evidence clearly listed
NOT_COVERED — no verified record exists for this location;
  invites the user to help expand coverage rather than
  returning a generic error
```

### 10 Screens (each answers exactly one question, maps to one primary API)
1. Home Screen — "What are you looking for?"
2. AI Search — "What exactly do you need?"
3. Recommendation Results — "What should I consider?"
4. Recommendation Details — "Why did AI recommend this?"
5. Society Profile — "Is this society trustworthy?"
6. Builder Profile — "Can this builder deliver?"
7. Property Details — "Should I buy this property?"
8. Construction Estimate — "What will this cost?" **(moved to v1.1 — see below)**
9. Evidence Drawer — "Can I verify this myself?"
10. Submit Evidence — "Can I help improve Siraat?"

### Example User Stories (representative, not exhaustive)
- US-001 Search by Intent (Buyer, plain language)
- US-002 Trust Recommendation (Buyer, explainability)
- US-003 Society Verification (Investor, independent evidence review)
- US-004 Evidence Contribution (any user, flywheel)
- US-005 Construction Estimate (future homeowner, budget planning — v1.1)

### Acceptance Criteria (minimum, all features)
AI responses must always cite evidence + confidence · never fabricate missing data · unsupported areas return `NOT_COVERED`, never a generic error · every recommendation includes explanation + confidence + evidence access · evidence submissions enter the verification queue as untrusted until reviewed · affiliated entities always display disclosure.

### API Traceability Matrix (corrected to Phase 11 route convention)

| Screen | Primary API |
|---|---|
| Home Search | `POST /v1/market-intelligence/recommendations` |
| Recommendation Details | `GET /v1/market-intelligence/recommendations/{id}` |
| Property Details | `GET /v1/property-intelligence/properties/{id}` |
| Society Profile | `GET /v1/trust/societies/{id}/noc-status` |
| Builder Profile | `GET /v1/trust/developers/{id}/verification` |
| Construction Estimate | `POST /v1/construction-intelligence/estimates` (v1.1) |
| Evidence Drawer | `GET /v1/trust/evidence/{id}` |
| Submit Evidence | `POST /v1/trust/evidence-submissions` (addendum, §16) |

### MVP Roadmap Decision — Construction Estimate Deferred to v1.1
**Reasoning (CTO + CPO consensus):** Phase 4's MVTD capacity model (30–35 societies, 3.5 hrs/society) was calculated around **Society verification effort only** — it never budgeted hours for building Construction Intelligence's cost-estimation data to launch quality. Including it in MVP would either require re-deriving Phase 4's entire capacity math, or ship an inconsistent trust signal (a thin/unverified estimate sitting beside rigorously-verified Society data on the same screen) — directly undermining Product Law #2. Construction OS becomes the intentional flagship of v1.1 rather than a rushed MVP add-on.

### Roadmap
```
MVP (Launch): AI hybrid search, trust-first recommendations,
  Society/Property/Builder profiles, Evidence viewer, Evidence
  submission, Save/share
v1.1: Construction Estimate, portfolio tracking, investment
  comparison, watchlists, builder dashboards, market trends
Future: Full SCOS, contractor/material/supplier marketplaces,
  financial products, enterprise dashboards, multi-city rollout,
  GCC expansion, predictive intelligence, autonomous agents
  (only if Phase 5's named triggers are met)
```

### Additional Product Concepts Locked This Phase
- **Product Maturity Levels:** Experimental / Supported / Trust Certified — additive, distinct from Phase 6's `lifecycle_stage` (product-facing vs. data-facing labels, kept separate)
- **"Moments of Delight"** as an explicit PRD design category (e.g., transparent multi-source confidence explanations; "you're the Nth person requesting this area" demand signaling)
- **UX Guardrail:** Every screen must be able to answer "Why should I trust this?" or it doesn't belong in the product.

---
