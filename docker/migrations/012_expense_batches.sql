-- 012_expense_batches.sql
--
-- WHATSAPP BULK EXPENSES — a multi-line "Project Expense:" ledger becomes ONE
-- pending batch; a single YES reply creates all its expenses.
--   * data_acquisition.whatsapp_expense_batches — the parsed, not-yet-saved
--     lines (UNTRUSTED until confirmed; nothing here is a FACT).
--   * construction_intelligence.project_expenses.paid_by — who paid out of
--     pocket ("paid by Abu"); nullable, additive.
--
-- Run manually against production.

BEGIN;

CREATE TABLE IF NOT EXISTS data_acquisition.whatsapp_expense_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message_id UUID NOT NULL,
  project_ref UUID NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  lines JSONB NOT NULL,
  line_count INT NOT NULL,
  total_amount DECIMAL(14, 2) NOT NULL,
  result JSONB,
  raw_ai_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_expense_batches_project_status
  ON data_acquisition.whatsapp_expense_batches (project_ref, status);

ALTER TABLE construction_intelligence.project_expenses
  ADD COLUMN IF NOT EXISTS paid_by VARCHAR(100);

COMMIT;
