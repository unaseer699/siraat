import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

// REVIEW_BACKLOG item 10 — fail loudly at startup instead of booting against an
// uninitialised database and answering every request with a 500.
//
// - A missing SCHEMA is fatal: the app cannot work at all, so startup stops with
//   a message saying exactly what to run.
// - A missing migration column/table is logged at ERROR level with the migration
//   number, but startup continues: most of the app still works and the founder
//   may be mid-deploy (migrations are applied by hand, before the backend that
//   needs them). The log line is the "you forgot a migration" alarm.

// Only schemas that hold tables today ('identity' exists but is unused, so it is not required).
export const REQUIRED_SCHEMAS = [
  'data_acquisition',
  'property_intelligence',
  'trust',
  'construction_intelligence',
  'market_intelligence',
] as const;

// One representative column per recent migration (add a line with every new migration).
export const REQUIRED_COLUMNS: Array<{ migration: string; schema: string; table: string; column: string }> = [
  { migration: '022_society_details', schema: 'property_intelligence', table: 'societies', column: 'zone' },
  { migration: '023_contractor_portfolio', schema: 'property_intelligence', table: 'contractor_projects', column: 'photos' },
  { migration: '024_project_soft_delete', schema: 'construction_intelligence', table: 'construction_projects', column: 'deleted_at' },
  { migration: '025_expense_attachments', schema: 'construction_intelligence', table: 'expense_attachments', column: 'expense_ref' },
  { migration: '026_supplier_location_phones', schema: 'property_intelligence', table: 'suppliers', column: 'location_url' },
  { migration: '027_whatsapp_accounts', schema: 'data_acquisition', table: 'whatsapp_accounts', column: 'wa_id' },
];

export function findMissingSchemas(present: string[]): string[] {
  const have = new Set(present);
  return REQUIRED_SCHEMAS.filter((s) => !have.has(s));
}

export function findMissingColumns(present: Array<{ table_schema: string; table_name: string; column_name: string }>): string[] {
  const have = new Set(present.map((r) => `${r.table_schema}.${r.table_name}.${r.column_name}`));
  return REQUIRED_COLUMNS.filter((c) => !have.has(`${c.schema}.${c.table}.${c.column}`)).map(
    (c) => `${c.migration} (${c.schema}.${c.table}.${c.column})`,
  );
}

@Injectable()
export class SchemaGuardService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaGuardService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SKIP_SCHEMA_CHECK === 'true') return;

    const schemas: Array<{ schema_name: string }> = await this.dataSource.query(
      'SELECT schema_name FROM information_schema.schemata',
    );
    const missingSchemas = findMissingSchemas(schemas.map((r) => r.schema_name));
    if (missingSchemas.length > 0) {
      throw new Error(
        `Database is not initialised: missing schema(s) ${missingSchemas.join(', ')}. ` +
          'Run docker/init-schemas.sql against DATABASE_URL, then restart. (Set SKIP_SCHEMA_CHECK=true to bypass.)',
      );
    }

    const columns: Array<{ table_schema: string; table_name: string; column_name: string }> = await this.dataSource.query(
      'SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_schema = ANY($1)',
      [REQUIRED_COLUMNS.map((c) => c.schema).filter((v, i, a) => a.indexOf(v) === i)],
    );
    const missing = findMissingColumns(columns);
    if (missing.length > 0) {
      this.logger.error(
        `Pending database migration(s): ${missing.join('; ')}. Run the files in docker/migrations/ — features that use them will fail until you do.`,
      );
    } else {
      this.logger.log('Database schemas and recent migrations verified');
    }
  }
}
