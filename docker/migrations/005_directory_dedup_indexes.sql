-- 005_directory_dedup_indexes.sql
--
-- PRE-DATA-POPULATION REVIEW — findings #1/#4: application-level dedup
-- checks (findSocietyByNameAndCity, findContractorByName, findSupplierByName,
-- findHousePlanByTitleAndSpecs) catch duplicates in the common case, but
-- without a DB-level constraint backing them, two concurrent admin
-- submissions can both pass the check before either insert commits — a real
-- race, not a hypothetical one (it's exactly what created the original
-- duplicate "AGOCHS, Phase-II" rows the Society check was built to catch,
-- per the comment on PropertyIntelligenceService.createSociety).
--
-- These are case-insensitive UNIQUE indexes on LOWER(...) — a backstop that
-- makes the race impossible at the database layer, not a replacement for the
-- app-level checks (which exist to give a friendly error message instead of
-- a raw constraint-violation 500).
--
-- Must be run manually against production (same as 002/003/004) — there is
-- no auto-migration step in the deploy pipeline.

BEGIN;

-- Society: name scoped to city (a name like "Park View City" can legitimately
-- exist in more than one city — see createSociety's comment).
CREATE UNIQUE INDEX IF NOT EXISTS idx_societies_dedup
  ON property_intelligence.societies (LOWER(name), LOWER(city));

-- Contractor / Supplier: nationwide directory identities, not scoped to a
-- single city (service_cities is multi-valued on both), so name alone is
-- the dedup key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contractors_dedup
  ON property_intelligence.contractors (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_dedup
  ON property_intelligence.suppliers (LOWER(name));

-- House Plan: title alone is too weak a signal for a plan catalog (many
-- genuinely different plans share a generic title like "5 Marla Modern
-- Home"), so the index matches createHousePlan's dedup check — title plus
-- area/bedrooms/style together.
CREATE UNIQUE INDEX IF NOT EXISTS idx_house_plans_dedup
  ON property_intelligence.house_plans (LOWER(title), area_marla, bedrooms, style);

COMMIT;
