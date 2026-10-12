ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS zone varchar(50);
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS road varchar(255);
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS area_kanal numeric(10,2);
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS owner_name varchar(255);
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS contact_phones text[] NOT NULL DEFAULT '{}';
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS email varchar(255);
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS website varchar(255);
ALTER TABLE property_intelligence.societies ADD COLUMN IF NOT EXISTS details_source_url text;
