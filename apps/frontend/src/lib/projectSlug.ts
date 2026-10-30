// Report links look like /project/test-house-<project id>. The name makes the
// link recognisable and trustworthy; the id at the end is what actually finds
// the project. Plain /project/<id> links keep working.
const UUID_AT_END = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function projectIdFromParam(param: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(param);
    } catch {
      return param;
    }
  })();
  return UUID_AT_END.exec(decoded)?.[1] ?? decoded;
}
