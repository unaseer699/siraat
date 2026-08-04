# SIRAAT — PHASE 9 — SECURITY & IAM (Frozen v1.0)

> Part of the Siraat frozen architecture & product documentation set. See `00-index.md` for the full document map.

---

# 11. PHASE 9 — SECURITY & IAM (Frozen v1.0)

### AI Orchestrator Permission Model — LOCKED: Option A (User-Scoped Delegation)
```
User Request (JWT) → AI Orchestrator → Identity Auth Module
  exchanges JWT → short-lived OBO (On-Behalf-Of) token
  → Downstream Context APIs

Result: Orchestrator physically cannot exceed the calling user's
own permissions. Cross-tenant requests rejected (403) at the API
boundary regardless of what the Orchestrator was tricked into requesting.
```
Chosen over Option B (service credentials + downstream checks) specifically because it provides **structural immunity**, not developer-discipline-dependent protection — same philosophy as the Phase 5 affiliation rule.

### System/Service Identity (separate channel, closes a real gap)
Each module authenticates system-to-system and event-bus activity via its **own scoped service credential** (`trust-module-service`, etc.) — never interchangeable with user OBO tokens. Governs scheduled jobs, background workers, event publishing.

### Auth Propagation
In-process (Phase 7): request-scoped SecurityContext (`user_id, roles[], tenant_jurisdiction, session_id`). Post-extraction: serializes into signed Bearer JWT/OBO token — authorization logic unchanged.

### Defense-in-Depth Against Prompt Injection
```
LAYER 1 — Input Tagging: scraped web content AND Evidence document
  content (OCR'd uploads) both tagged UNTRUSTED_DATA (extended to
  cover both entry points during CTO review)
LAYER 2 — Structural OBO Tool Guard: tool calls execute only via
  short-lived, user-scoped tokens
LAYER 3 — Output Sanitizer & Affiliation Guard: mechanically
  enforces Phase 5's disclosure requirement before returning to client
```

### High-Stakes Field Integrity
**Per-context HMAC signing keys** (never shared across contexts — closes a single-point-of-failure risk in an earlier draft that proposed one shared key). `row_hmac = HMAC_SHA256(entity_id + value + context_owned_key)` on `is_siraat_affiliated`, `score_value`, etc. Tampering detected on read → rejected, alert raised. Key storage/rotation mechanics deferred to Phase 10; scoping (one key per context) locked here.

### Evidence Storage Security
Private buckets, zero public access. Pre-signed URLs, TTL ≤15 minutes, issued only by Trust context. Unverified uploads isolated to uploader + internal `VERIFICATION_ADMIN` staff role.

### Data Classification → Security Mapping

| Class | Example | At Rest | In Transit | Access |
|---|---|---|---|---|
| Identity/PII | Profile, CNIC | AES-256 column-level | TLS 1.3 | Owner or Admin |
| Transactional | Budgets, invoices | AES-256 column-level | TLS 1.3 | Owner or Authorized Role |
| Evidence | NOC docs, receipts | AES-256 bucket-level | TLS 1.3, signed URLs | Verified-public or Admin |
| Reference/Master | Society boundaries | Disk encryption | TLS 1.3 | Public read |
| Generated Intelligence | Scores, Recommendations | Disk encryption | TLS 1.3 | Authenticated, tiered |

### Role Model Clarification
Public User Roles (Phase 1): Buyer, Investor, Builder, Contractor, Developer, Supplier, Professional.
Internal Staff Roles (new): `VERIFICATION_ADMIN` and future internal roles — `is_internal_staff=true`, never self-assignable by a public User.

---
