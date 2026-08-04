# SIRAAT — PHASE 7 — MICROSERVICES ARCHITECTURE (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 9. PHASE 7 — MICROSERVICES ARCHITECTURE (Frozen v1.0)

### Central Decision: Modular Monolith at Launch
Working hypothesis tested and adopted: **one deployable application** containing six strictly-separated internal modules, **plus one small separate process** for the Knowledge Graph Projection Service.

### Core Enforcement Rules
```
1. No direct cross-module imports.
2. Public API/DTO or in-process event only — same discipline
   as a network call would require.
3. No database transaction spans more than one module's schema,
   even within the shared connection pool (added during CTO review).
4. Each module retains its own schema per Phase 6 — no exceptions.
5. Knowledge Graph Projection Service runs as a SEPARATE process
   from day one — protects the customer-facing API's fault domain
   (amended from Gemini's original "in-process thread" proposal).
6. AI Orchestrator deployed in-process for DEPLOYMENT SIMPLICITY
   — not latency (corrected: LLM API round-trip dominates response
   time regardless of co-location).
```

### Property/Construction Intelligence Resolution (closes Phase 2's flagged item)
Module-level separation, not service-level, at launch:
- Fast leaf data (listings, material prices) → async background workers within the module
- Slow reference data (Location, Developer profile, methodology) → live API threads
- Extraction trigger: if worker load measurably degrades API performance, extract only the worker process

### Regional Expansion Readiness
`country_code` field, defaulting to `PK` — named, not designed further (Future Domain).

### Growth Path
```
Phase 1 Launch: 2 deployment units (Main App + Graph Projection Service)
Post-MVTD: extract high-load workers as needed
Enterprise: extract individual contexts into full services — 
  zero rewrite required, per Public API discipline
```

---
