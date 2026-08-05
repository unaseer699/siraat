-- Capability 5 — GIN index on property_intelligence.societies.property_types
--
-- This index was declared in docker/init-schemas.sql but never applied because
-- init-schemas.sql only runs on first Docker volume creation, before the societies
-- table existed. Apply this manually once against the running database.
--
-- Safe to run multiple times — IF NOT EXISTS guard.
--
-- Usage:
--   docker exec -i siraat-postgres psql -U siraat -d siraat -f /docker-entrypoint-initdb.d/migrations/001_gin_index_societies_property_types.sql
-- Or connect to the database and run:
--   \i docker/migrations/001_gin_index_societies_property_types.sql

CREATE INDEX IF NOT EXISTS idx_societies_property_types
  ON property_intelligence.societies USING GIN (property_types);
