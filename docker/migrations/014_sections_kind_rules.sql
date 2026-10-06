ALTER TABLE construction_intelligence.project_expenses ADD COLUMN IF NOT EXISTS kind VARCHAR(10);
CREATE TABLE IF NOT EXISTS construction_intelligence.expense_category_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pattern varchar(200) NOT NULL, category varchar(30) NOT NULL, kind varchar(10), created_at timestamp NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_category_rules_pattern ON construction_intelligence.expense_category_rules (pattern);
INSERT INTO construction_intelligence.expense_category_rules (pattern, category, kind) VALUES ('mason work labour', 'MASON_LABOUR', 'LABOUR'), ('gera', 'MASON_GREY_STRUCTURE', 'MATERIAL'), ('building wire', 'STEEL_MATERIAL', 'MATERIAL') ON CONFLICT (pattern) DO NOTHING;
