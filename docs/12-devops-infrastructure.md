# SIRAAT — PHASE 10 — DEVOPS & CLOUD INFRASTRUCTURE (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 12. PHASE 10 — DEVOPS & CLOUD INFRASTRUCTURE (Frozen v1.0)

### Platform Pivot (explicitly founder-confirmed)
Roadmap phase retitled: **"DevOps & Cloud Infrastructure (DigitalOcean Primary, AWS Migration Target)"** — moved away from the originally-locked "DevOps & AWS" title based on cost analysis (~$0/month via credits vs. ~$200+/month) with zero architectural-law violations.

### Infrastructure Stack
```
Compute:      DO App Platform — 2 components: siraat-monolith-app
              + siraat-graph-worker (matches Phase 7's two units)
Database:     DO Managed PostgreSQL, single node at launch,
              schema-isolated per Phase 6, pgcrypto for HMAC
Object Store: DO Spaces (S3-compatible), private, pre-signed URLs
Graph Engine: Apache AGE on Postgres (default) — Neo4j Community
              Edition as a NAMED FALLBACK TRIGGER (>3-hop queries
              exceeding 250ms, or Postgres compatibility breaks)
Secrets:      Process-level env vars — see honest limitation below
CI/CD:        GitHub Actions (free tier) → DO App Platform auto-deploy
```

### Decision Log
1. **Secrets Isolation — Honest Limitation (not a false guarantee):** Within the shared monolith process, per-context HMAC key separation is enforced by **code discipline/convention only** — NOT true runtime memory isolation (any in-process code can technically read any env var). This is a stated, accepted risk at MVTD scale. Becomes TRUE runtime isolation automatically post-extraction, with zero code change, once a context becomes its own container.
2. **Graph Engine:** Apache AGE default, Neo4j fallback — mirrors Phase 7's extraction-trigger pattern.
3. **Database HA:** Corrected an inaccurate "automatic failover" claim — single node at launch, daily backups + point-in-time recovery, standby/HA node deferred to a post-launch scaling trigger.
4. **Platform pivot:** Explicitly confirmed by founder (not self-approved by Systems Architect, per the "never assume approval" rule reinforced this phase).

### Cost Model
~$37–57/month un-discounted baseline; **~$0/month with referral credits** during build/launch.

### Migration Path to AWS (kept real, not over-engineered)
DO Spaces→S3 (config change), DO Managed Postgres→RDS (standard dump/restore), DO App Platform→ECS/Fargate/EKS (containers already portable).

---
