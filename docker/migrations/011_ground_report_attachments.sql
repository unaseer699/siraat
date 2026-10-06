-- 011_ground_report_attachments.sql
--
-- GROUND-CONDITION REPORTS — photos / soil-test PDFs and the WhatsApp route.
--   * submissions.attachments — JSON list of private storage keys
--     ({key, content_type, size_bytes}); files are never public, admin views
--     them through short-lived signed links.
--   * submissions.source      — WEB or WHATSAPP (WhatsApp reports use the
--     sender's own verified number as the reporter phone).
--   * facts.evidence_count    — how many files backed an approved report
--     (the files themselves stay on the submission, private).
--
-- Run manually against production. Requires 010.

BEGIN;

ALTER TABLE data_acquisition.ground_report_submissions
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'WEB';

ALTER TABLE property_intelligence.ground_condition_facts
  ADD COLUMN IF NOT EXISTS evidence_count INT NOT NULL DEFAULT 0;

COMMIT;
