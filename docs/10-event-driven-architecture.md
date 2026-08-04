# SIRAAT — PHASE 8 — EVENT-DRIVEN ARCHITECTURE (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 10. PHASE 8 — EVENT-DRIVEN ARCHITECTURE (Frozen v1.0)

### Tiered Delivery Model
```
TIER 1 — Critical Fact & Audit Events
  Events: VerificationStatusChanged, FactIngested, ObservationRecorded,
          LegalDocSubmitted, EvidenceAdded
  Guarantee: At-Least-Once + Transactional Outbox (per-module schema)
             + Idempotent Processing
  Failure: Retry w/ backoff → DLQ → mandatory human review within
           24-HOUR SLA (locked)

TIER 2 — Derived & Projection Events
  Events: ScoreCalculated, GraphNodeProjected, RecommendationGenerated
          (clarified: audit/outcome-logging purpose, NOT a
          state-building trigger for other consumers)
  Guarantee: Best-effort, rebuildable via re-projection/backfill
```

### Universal Event Envelope
```json
{
  "event_id": "evt_<uuid>", "trace_id": "trc_<uuid>",
  "event_type": "siraat.<context>.<event_name>.v1",
  "source_context": "Trust", "producer_module": "trust",
  "producer_service": "siraat-monolith-app",
  "event_timestamp": "ISO-8601", "schema_version": "1.0",
  "partition_key": "<subject_id>", "payload": { "record_type": "..." }
}
```

### Schema Isolation Applied to Event Infrastructure
Outbox tables and idempotency dedup tables are **per-module**, inside that module's own schema — never shared, mirroring Phase 6's core discipline.

### Ordering
Per-entity ordering only, via mandatory `partition_key`. No global ordering attempted.

### Migration Path (Zero-Rewrite Contract)
Business modules depend only on `EventPublisher.publish(envelope)`. Launch: `InProcessEventPublisherAdapter`. Scale: `DistributedBrokerPublisherAdapter` (Kafka/EventBridge). Swap = config change only. SCOS integrates as a standard consumer against the same contract.

### Graph Projection Resilience
Tier 2 tolerance — backfills from context Snapshot/Delta Ledgers if it falls behind or restarts. No data-loss risk to the source of truth.

---
