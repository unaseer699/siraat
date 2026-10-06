-- Allow one WhatsApp number to be linked to several projects.
-- Find the old unique index name first:
--   SELECT indexname FROM pg_indexes WHERE tablename = 'whatsapp_project_mappings';
-- Then: DROP INDEX data_acquisition."<that name>";
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_mapping_wa_project ON data_acquisition.whatsapp_project_mappings (wa_id, project_ref);
