-- 008_listing_marketplace.sql
--
-- WHATSAPP LISTING INGESTION — marketplace hygiene at volume:
--   * sold_at            — a plot marked sold (admin click, or a forwarder's
--                          "SOLD 7473" WhatsApp message) stops showing at once
--                          instead of lingering until its 14-day expiry.
--   * last_confirmed_at  — refreshed each time a dealer re-forwards the same
--                          plot (dedup refresh); drives the "confirmed X ago"
--                          label and the 7-day "may be sold" badge.
--   * listing_alert_subscriptions — visitors who want a WhatsApp alert when a
--                          new plot matching their criteria is published.
--
-- Run manually against production (same as 002-007). Requires 006 and 007.

BEGIN;

ALTER TABLE property_intelligence.property_listings
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;

UPDATE property_intelligence.property_listings
   SET last_confirmed_at = published_at
 WHERE last_confirmed_at IS NULL;

ALTER TABLE property_intelligence.property_listings
  ALTER COLUMN last_confirmed_at SET NOT NULL,
  ALTER COLUMN last_confirmed_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_property_listings_plot_number
  ON property_intelligence.property_listings (plot_number);

CREATE TABLE IF NOT EXISTS data_acquisition.listing_alert_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id VARCHAR(32) NOT NULL,
  society_key VARCHAR(255),
  city VARCHAR(100),
  max_price_lac DECIMAL(10, 2),
  min_size_marla DECIMAL(6, 2),
  active BOOLEAN NOT NULL DEFAULT true,
  daily_count INT NOT NULL DEFAULT 0,
  daily_count_date DATE,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_alert_subscriptions_wa_id
  ON data_acquisition.listing_alert_subscriptions (wa_id);
CREATE INDEX IF NOT EXISTS idx_listing_alert_subscriptions_active
  ON data_acquisition.listing_alert_subscriptions (active);

COMMIT;
