-- HOUSE PLAN GALLERY — adds house_plan_images, a tagged multi-image set per
-- house plan (floor plan / front elevation / side elevation / 3D render),
-- each carrying an access tier (FREE/GATED) and a required price. Additive
-- only: house_plans.preview_image_ref is untouched and keeps backing the
-- catalog-grid thumbnail.
--
-- Safe to run multiple times.
--
-- Usage (from the repo root; docker/migrations is not mounted in the
-- container — see 002's header for the same note):
--   docker exec -i siraat-postgres psql -v ON_ERROR_STOP=1 -U siraat -d siraat < docker/migrations/003_house_plan_gallery.sql
--
-- Run this BEFORE booting the backend, same as 002 — TypeORM's
-- synchronize:true can create the table in dev, but not the FK, the
-- CHECK constraints, or the index name the entity's @Index derives, so
-- this file is authoritative for all of those everywhere.

BEGIN;

CREATE TABLE IF NOT EXISTS property_intelligence.house_plan_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_plan_id uuid NOT NULL REFERENCES property_intelligence.house_plans(id) ON DELETE CASCADE,
  image_type varchar(20) NOT NULL,
  access_tier varchar(10) NOT NULL DEFAULT 'FREE',
  price decimal(10, 2) NOT NULL DEFAULT 0,
  storage_ref text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT house_plan_images_image_type_check
    CHECK (image_type IN ('FLOOR_PLAN', 'ELEVATION_FRONT', 'ELEVATION_SIDE', 'RENDER_3D')),
  CONSTRAINT house_plan_images_access_tier_check
    CHECK (access_tier IN ('FREE', 'GATED')),
  CONSTRAINT house_plan_images_price_non_negative CHECK (price >= 0)
);

-- Named explicitly rather than guessing TypeORM's derived hash (unlike 002,
-- this wasn't run against a live synchronize:true to confirm the exact name
-- first). If dev's synchronize adds its own same-purpose index under a
-- different name, that's a harmless duplicate, not a conflict — drop
-- whichever one is redundant once confirmed.
CREATE INDEX IF NOT EXISTS idx_house_plan_images_house_plan_id
  ON property_intelligence.house_plan_images (house_plan_id);

COMMIT;
