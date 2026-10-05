-- 006_whatsapp_listing_ingestion.sql
--
-- WHATSAPP LISTING INGESTION — real-estate-group daily inventory, forwarded
-- by the founder via WhatsApp after personally verifying it, instead of
-- manual entry. Three new tables:
--
--   data_acquisition.whatsapp_listing_forwarders  — sender allowlist. Reuses
--     the existing WhatsApp number/webhook (no second Meta line needed):
--     a message from a wa_id in this table is routed to the listing parser
--     instead of the construction-expense parser, regardless of whether
--     that number also happens to have a project mapping.
--
--   data_acquisition.whatsapp_draft_listings — one row per PLOT (a
--     multi-plot line like "FHC 7915 16" is split into two rows at parse
--     time, not stored as one row). Sits in a verification queue exactly
--     like whatsapp_draft_expenses (Law 8: UNTRUSTED_DATA held for human
--     review, never auto-promoted) — but PENDING_REVIEW -> PUBLISHED is a
--     single admin action, not a confirm-reply loop, since the founder has
--     already verified the source message before forwarding it.
--
--   property_intelligence.property_listings — the published, public-facing
--     FACT record. society_ref is a plain uuid string (Law 1: zero
--     cross-context FKs) — nullable, since the forwarded society/block name
--     may not match anything in the Society directory yet. source_ref
--     points back at the originating whatsapp_draft_listings row, also a
--     plain string, never a SQL FK (Law 1/2: no cross-schema FK, no
--     cross-schema transaction).
--
-- Must be run manually against production (same as 002-005) — no
-- auto-migration step in the deploy pipeline.

BEGIN;

CREATE TABLE IF NOT EXISTS data_acquisition.whatsapp_listing_forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id VARCHAR(32) NOT NULL,
  label VARCHAR(255) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_listing_forwarders_wa_id
  ON data_acquisition.whatsapp_listing_forwarders (wa_id);

CREATE TABLE IF NOT EXISTS data_acquisition.whatsapp_draft_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message_id UUID NOT NULL,
  society_name_raw TEXT NOT NULL,
  block VARCHAR(20),
  plot_number VARCHAR(20) NOT NULL,
  size_raw TEXT,
  size_marla DECIMAL(6, 2),
  price_lac DECIMAL(10, 2),
  status_raw TEXT,
  raw_line TEXT NOT NULL,
  raw_ai_response JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
  listing_ref UUID,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_draft_listings_status
  ON data_acquisition.whatsapp_draft_listings (status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_draft_listings_inbound_message
  ON data_acquisition.whatsapp_draft_listings (inbound_message_id);

CREATE TABLE IF NOT EXISTS property_intelligence.property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_ref UUID,
  society_name_raw TEXT NOT NULL,
  city VARCHAR(100),
  block VARCHAR(20),
  plot_number VARCHAR(20) NOT NULL,
  size_marla DECIMAL(6, 2),
  price_lac DECIMAL(10, 2),
  status_raw TEXT,
  source_ref UUID NOT NULL,
  is_siraat_affiliated BOOLEAN NOT NULL DEFAULT false,
  record_type VARCHAR(10) NOT NULL DEFAULT 'FACT',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_listings_society_ref
  ON property_intelligence.property_listings (society_ref);
CREATE INDEX IF NOT EXISTS idx_property_listings_expires_at
  ON property_intelligence.property_listings (expires_at);

COMMIT;
