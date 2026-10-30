import { SchemaGuardService, findMissingColumns, findMissingSchemas, REQUIRED_COLUMNS, REQUIRED_SCHEMAS } from './schema-guard';

describe('schema guard', () => {
  it('reports missing schemas', () => {
    expect(findMissingSchemas([...REQUIRED_SCHEMAS])).toEqual([]);
    expect(findMissingSchemas(['trust', 'public'])).toContain('property_intelligence');
  });

  it('reports a missing migration column by migration number', () => {
    const all = REQUIRED_COLUMNS.map((c) => ({ table_schema: c.schema, table_name: c.table, column_name: c.column }));
    expect(findMissingColumns(all)).toEqual([]);
    const without = all.filter((r) => r.table_name !== 'suppliers');
    expect(findMissingColumns(without)).toEqual([expect.stringContaining('026_supplier_location_phones')]);
  });

  function make(schemas: string[], cols: Array<Record<string, string>>) {
    const query = jest.fn(async (sql: string) => (sql.includes('schemata') ? schemas.map((schema_name) => ({ schema_name })) : cols));
    return new SchemaGuardService({ query } as never);
  }

  it('refuses to start when a schema is missing', async () => {
    await expect(make(['trust'], []).onApplicationBootstrap()).rejects.toThrow(/init-schemas\.sql/);
  });

  it('starts (with an error log) when only a migration is missing', async () => {
    const svc = make([...REQUIRED_SCHEMAS], []);
    const err = jest.spyOn((svc as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => undefined);
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Pending database migration'));
  });

  it('can be bypassed', async () => {
    process.env.SKIP_SCHEMA_CHECK = 'true';
    await expect(make([], []).onApplicationBootstrap()).resolves.toBeUndefined();
    delete process.env.SKIP_SCHEMA_CHECK;
  });
});
