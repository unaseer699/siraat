# SIRAAT — WORKING MODEL & GOVERNANCE

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 2. WORKING MODEL & GOVERNANCE

**Team roles (finalized):**
- **Umar Naseer** — Founder/CEO: vision, product, business, final trade-off authority
- **Claude** — Founding CTO: architecture, DDD, engineering rigor, API/schema traceability enforcement
- **ChatGPT** — Co-founder/CPO: strategy, product, prioritization, execution, challenging assumptions
- **Gemini** — Chief Research & Systems Architect: alternative designs, research validation, scalability, technology research, scope-discipline enforcement

**Engineering workflow (locked from project start):**
```
Founder → CPO (vision/strategy) → CTO (review → challenge → propose →
draft → self-critique → identify risks → revise → present) →
Founder Approval → Freeze (v1.0) → Next Document
```

**Non-negotiable rules:**
- Never generate multiple major documents in one response.
- Challenge assumptions before accepting them.
- **Never assume approval.** Only the Founder freezes a document — not the CTO, not the CPO, not the Research Chief, regardless of technical consensus. (This rule was explicitly reinforced twice — Phase 9 and Phase 10 — when Gemini's drafts declared documents "FROZEN & APPROVED" prematurely; corrected each time before founder sign-off.)
- Document order is locked; no phase-jumping.

**Document format (adopted from Phase 3 onward):**
1. Founder Summary (Plain English) 2. Glossary 3. Technical Architecture 4. Example/Scenario 5. Diagrams 6. Self-Review 7. Founder Review

**Recurring project-wide pattern:** When faced with a "how much rigor now vs. later" choice, the project consistently chose the simpler, more disciplined option over the more impressive-sounding one — and every instance strengthened rather than weakened the outcome:
- No monolithic Knowledge Context (Phase 2)
- Read-only Graph projection, not a shared store (Phase 3)
- MVTD (30–35 societies) over comprehensive coverage (Phase 4)
- Single AI orchestrator, not multi-agent (Phase 5)
- Modular monolith at launch, not microservices from day one (Phase 7)
- DigitalOcean lean stack over AWS complexity (Phase 10)
- MVP scope protected against a 40+ document "documentation library" and against premature Construction Estimate inclusion (Phase 12)

---
