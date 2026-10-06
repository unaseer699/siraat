-- 007_listing_contact_phone.sql
--
-- WHATSAPP LISTING INGESTION — optional dealer contact number on a plot
-- listing. Nullable everywhere: forwarded inventory often carries no number,
-- and a listing must still publish without one. Extracted by the AI from the
-- forwarded message where present, editable by the admin at publish time.
--
-- Run manually against production (same as 002-006).

BEGIN;

ALTER TABLE data_acquisition.whatsapp_draft_listings
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32);

ALTER TABLE property_intelligence.property_listings
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32);

COMMIT;
