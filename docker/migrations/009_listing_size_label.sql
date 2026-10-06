-- 009_listing_size_label.sql
--
-- WHATSAPP LISTING INGESTION — plot size as a displayed/filterable LABEL
-- ("25x50", "30x60", "1 Kanal"), kept alongside the numeric size_marla
-- (which only drives price-per-marla). The draft table already stores the
-- label in size_raw; the published table needs its own column.
--
-- Run manually against production (same as 002-008). Requires 006-008.

BEGIN;

ALTER TABLE property_intelligence.property_listings
  ADD COLUMN IF NOT EXISTS size_label VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_property_listings_size_label
  ON property_intelligence.property_listings (size_label);

COMMIT;
