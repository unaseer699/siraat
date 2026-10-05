-- 004_house_plan_image_content_type.sql
--
-- HOUSE PLAN GALLERY — adds content_type to house_plan_images so the
-- gallery can tell a PDF (3D render walkthroughs are often a multi-page
-- PDF rather than a single image) apart from a plain image at render time,
-- instead of guessing from the filename.
--
-- Must be run manually against production (same as 002/003) — there is no
-- auto-migration step in the deploy pipeline.

BEGIN;

ALTER TABLE property_intelligence.house_plan_images
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);

COMMIT;
