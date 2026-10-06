-- 010_ground_reports.sql
--
-- GROUND-CONDITION REPORTS — owners/builders report what they actually found
-- underground (soil test, foundation type/depth, fill) for a plot/block.
--
--   * data_acquisition.ground_report_submissions — raw, UNTRUSTED_DATA
--     (Law 8). Holds the reporter's phone (private, never exposed publicly).
--     An admin must approve each one.
--   * property_intelligence.ground_condition_facts — immutable FACT rows
--     created ONLY by admin approval (Law 3). No phone, no FK to the
--     submission (Law 1): source_ref is a plain uuid.
--
-- Run manually against production (same as 002-009).

BEGIN;

CREATE TABLE IF NOT EXISTS data_acquisition.ground_report_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_name_raw VARCHAR(255) NOT NULL,
  block VARCHAR(20) NOT NULL,
  plot_number VARCHAR(20),
  reporter_role VARCHAR(20) NOT NULL,
  reporter_phone VARCHAR(32) NOT NULL,
  ground_condition VARCHAR(20) NOT NULL,
  soil_test_done BOOLEAN NOT NULL DEFAULT false,
  foundation_type VARCHAR(20) NOT NULL,
  foundation_depth_ft DECIMAL(5, 1),
  extra_cost_lac DECIMAL(8, 2),
  build_year SMALLINT,
  notes TEXT,
  trust_tag VARCHAR(20) NOT NULL DEFAULT 'UNTRUSTED_DATA',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
  review_note TEXT,
  fact_ref UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ground_report_submissions_status
  ON data_acquisition.ground_report_submissions (status);
CREATE INDEX IF NOT EXISTS idx_ground_report_submissions_reporter
  ON data_acquisition.ground_report_submissions (reporter_phone);

CREATE TABLE IF NOT EXISTS property_intelligence.ground_condition_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_ref UUID,
  society_name_raw VARCHAR(255) NOT NULL,
  block VARCHAR(20) NOT NULL,
  plot_number VARCHAR(20),
  reporter_role VARCHAR(20) NOT NULL,
  ground_condition VARCHAR(20) NOT NULL,
  soil_test_done BOOLEAN NOT NULL DEFAULT false,
  foundation_type VARCHAR(20) NOT NULL,
  foundation_depth_ft DECIMAL(5, 1),
  extra_cost_lac DECIMAL(8, 2),
  build_year SMALLINT,
  notes TEXT,
  source_ref UUID NOT NULL,
  is_siraat_affiliated BOOLEAN NOT NULL DEFAULT false,
  record_type VARCHAR(10) NOT NULL DEFAULT 'FACT',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ground_condition_facts_block
  ON property_intelligence.ground_condition_facts (block);

COMMIT;
