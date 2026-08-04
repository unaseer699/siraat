-- Siraat: per-bounded-context schema isolation (Phase 6, Law 1)
-- Zero cross-schema foreign keys are permitted. Contexts reference each
-- other only via UUID strings, never SQL foreign keys.

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS data_acquisition;
CREATE SCHEMA IF NOT EXISTS property_intelligence;
CREATE SCHEMA IF NOT EXISTS trust;
CREATE SCHEMA IF NOT EXISTS construction_intelligence;
CREATE SCHEMA IF NOT EXISTS market_intelligence;

-- Enable pgcrypto for HMAC row-integrity tags (Phase 9)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable Apache AGE for the Knowledge Graph projection (Phase 3/10)
-- Uncomment once the apache/age Postgres image is used locally:
-- CREATE EXTENSION IF NOT EXISTS age;

-- GIN index on property_types array — TypeORM cannot auto-generate GIN indexes.
-- @Index('idx_societies_property_types', { synchronize: false }) on SocietyEntity
-- marks this as externally managed so TypeORM never tries to create or drop it.
CREATE INDEX IF NOT EXISTS idx_societies_property_types
  ON property_intelligence.societies USING GIN (property_types);
