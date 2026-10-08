ALTER TABLE construction_intelligence.construction_projects ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE construction_intelligence.construction_projects ADD COLUMN IF NOT EXISTS public_title varchar(100);
