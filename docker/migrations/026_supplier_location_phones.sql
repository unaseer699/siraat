ALTER TABLE property_intelligence.suppliers ADD COLUMN IF NOT EXISTS other_phones text[] NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS address text, ADD COLUMN IF NOT EXISTS location_url text
