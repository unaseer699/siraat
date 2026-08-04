# SIRAAT — PHASE 5 — AI AGENT ARCHITECTURE (Frozen v1.0, +2 addenda)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 7. PHASE 5 — AI AGENT ARCHITECTURE (Frozen v1.0, +2 addenda)

### Central Decision: Single Orchestrator, Not Multi-Agent
**Decision rule:** *"Could this just be another tool call?"* Six named triggers required to justify a dedicated agent (long-running autonomy, multi-day planning, different reasoning models, parallel multi-source investigation, persistent memory, independent business-capability ownership). **Every Phase-1-scale capability tested — none justified a dedicated agent.**

### Core Principle
> **AI is an orchestration layer, not a business owner.** Agents never own business rules, facts, scores, or decisions.

### Knowledge Graph vs. Bounded Context APIs — Resolved
```
Graph → relationship traversal, discovery, explainability
APIs  → authoritative/time-sensitive data, all writes
TIE-BREAK: bounded context always wins over the Graph.
```

### Verification
Confirmed **permanently human-only** — not a future agent candidate.

### Four Named Future Triggers (documented, not designed)
Triage volume growth · deep multi-hop comparative reasoning · new independently-owned capability (e.g. SCOS) · long-running autonomous monitoring.

### Strategic Realignment Incorporated
Not a portal — Trust is the product. Zoraiz Developers ↔ Siraat first-party data integration. **Siraat Construction OS (SCOS)** acknowledged as a named future capability, NOT designed.

### `is_siraat_affiliated` — Domain Model Amendment
```
Attribute on Developer and Property:
is_siraat_affiliated: boolean
  - Mandatory disclosure, user-visible
  - Never affects Score inputs[] (structurally absent)
  - Same Evidence bar as any entity — arguably higher, never lower
```

### HARD RULE (architectural law, structurally enforced)
> **Affiliation never changes trust. Evidence changes trust.**

1. No wiring from `is_siraat_affiliated` into Score's `inputs[]`.
2. Identical verification pipeline for affiliated entities — no fast-track.
3. Orchestrator **must** surface disclosure — a required field in Recommendation's output; omission = malformed output, not a style choice.
4. Affiliation itself is never a valid citation in reasoning.
5. Extends automatically to any future affiliated entity.

**Canonical example:**
> "Zoraiz Developers is affiliated with Siraat. This recommendation is based on verified evidence including completed projects, budget transparency, client feedback, and supplier verification. You may also compare it against other builders."

### SCOS — Integration Contract (binding, SCOS itself undesigned)
SCOS is a data-generation source structurally equivalent to Data Acquisition — produces facts, owns no cross-context business meaning; publishes via existing Construction Intelligence event contract; new entities become Construction Intelligence's concern when formally designed, not a new bounded context by default; same FACT/GENERATED discipline applies, first-party origin exempts nothing; no SCOS design work authorized until its own dedicated, founder-sequenced document; must integrate via events/APIs only, never bypass, never become a parallel source of truth.

---
