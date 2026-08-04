# SIRAAT — MASTER LIST OF STANDING ARCHITECTURAL LAWS (apply across all phases)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 15. MASTER LIST OF STANDING ARCHITECTURAL LAWS (apply across all phases)

1. Siraat stores facts. Siraat generates opinions from facts. (`FACT`/`GENERATED` typing, structurally enforced.)
2. No GENERATED artifact may ever become a canonical FACT input elsewhere.
3. No God Context — no context/service owns canonical facts across multiple business capabilities.
4. Event-first communication only.
5. Dependencies point inward only.
6. Anti-corruption layer required at every context boundary.
7. The Knowledge Graph is a read-only projection, never authoritative; bounded context always wins in a conflict.
8. Every node/entity has exactly one authoritative owner (Graph Identity Rule).
9. AI is an orchestration layer, not a business owner.
10. Verification is permanently human-only at Phase 1 scale.
11. Affiliation never changes trust or scoring; disclosure is mandatory and structurally enforced.
12. Any new capability (including SCOS) integrates via existing events/APIs — never bypasses, never becomes a parallel source of truth.
13. MVTD discipline — never trade verification quality for coverage.
14. *(Phase 6-specific, canonical for that phase)* The Nine Laws of Data Architecture — see §8.
15. No cross-schema database transactions, even within a shared connection pool (Phase 7).
16. Per-context HMAC signing keys — never a single shared secret across contexts (Phase 9).
17. AI Orchestrator permission model: user-scoped delegation (OBO tokens) — structural immunity over policy-based trust (Phase 9).
18. "Never assume approval" — only the Founder freezes a document, regardless of technical consensus among AI collaborators (reinforced Phases 9, 10).

---
