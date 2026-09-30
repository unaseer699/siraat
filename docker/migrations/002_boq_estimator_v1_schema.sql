-- MATERIAL + WORKS BOQ ESTIMATOR v1 — replaces the grey-structure-only
-- construction_estimates cache table shape entirely. This table is pure
-- GENERATED cache data (Law 3: never a FACT, always recomputable from
-- MaterialRateEntity + boq-catalog.ts's ratios), so there is no historical/
-- audit value in preserving old rows — truncate and reshape rather than a
-- data-preserving migration.
--
-- Safe to run multiple times.
--
-- Usage (from the repo root; docker/migrations is not mounted in the container):
--   docker exec -i siraat-postgres psql -v ON_ERROR_STOP=1 -U siraat -d siraat < docker/migrations/002_boq_estimator_v1_schema.sql
--
-- Run this BEFORE booting the backend, in dev as well as production. In dev,
-- TypeORM's synchronize:true cannot do this on its own: it tries
-- ADD COLUMN "area" ... NOT NULL against the existing rows and fails, which
-- stops the backend from starting.

BEGIN;

TRUNCATE TABLE construction_intelligence.construction_estimates;

ALTER TABLE construction_intelligence.construction_estimates
  DROP COLUMN IF EXISTS area_marla,
  DROP COLUMN IF EXISTS quality_tier,
  DROP COLUMN IF EXISTS missing_materials;

ALTER TABLE construction_intelligence.construction_estimates
  ADD COLUMN IF NOT EXISTS area DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS area_unit VARCHAR(10),
  ADD COLUMN IF NOT EXISTS area_sqft DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS floors SMALLINT,
  ADD COLUMN IF NOT EXISTS basement BOOLEAN,
  ADD COLUMN IF NOT EXISTS finish_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS missing_major_items TEXT[] DEFAULT '{}';

-- Table was just truncated, so these can be safely made NOT NULL for new rows.
ALTER TABLE construction_intelligence.construction_estimates
  ALTER COLUMN area SET NOT NULL,
  ALTER COLUMN area_unit SET NOT NULL,
  ALTER COLUMN area_sqft SET NOT NULL,
  ALTER COLUMN floors SET NOT NULL,
  ALTER COLUMN basement SET NOT NULL,
  ALTER COLUMN finish_level SET NOT NULL,
  ALTER COLUMN missing_major_items SET NOT NULL;

-- The old (city, area_marla, quality_tier) index is dropped automatically
-- with its columns above.
-- Index name must match the one TypeORM derives for the entity's @Index, or
-- dev's synchronize adds a second, duplicate index next to this one.
CREATE INDEX IF NOT EXISTS "IDX_01021966d00d59d55b3531fb53"
  ON construction_intelligence.construction_estimates (city, area_sqft, floors, basement, finish_level);

COMMIT;
