/**
 * Siraat QA Smoke Test
 *
 * Hits every major endpoint built across all 6 capabilities and asserts basic success.
 * This is NOT a substitute for the Jest suite — it's a fast "is the system alive" check
 * runnable against any environment (local or staging).
 *
 * Prerequisites:
 *   - Backend running with seed data loaded (scripts/seed-societies.sql + seed-trust.sql)
 *   - SIRAAT_API_KEY env var set on the backend
 *
 * Run (local):
 *   SMOKE_KEY=your-api-key ts-node -P scripts/tsconfig.scripts.json scripts/qa-smoke-test.ts
 *
 * Run (staging):
 *   SMOKE_BASE=https://api.siraat.app SMOKE_KEY=prod-key \
 *   ts-node -P scripts/tsconfig.scripts.json scripts/qa-smoke-test.ts
 *
 * Options:
 *   --test-rate-limit   Also fire 61 rapid requests to confirm 429 fires. Consumes the
 *                       test IP's rate quota for 60 seconds; run at most once per minute.
 */

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3001';
const KEY = process.env.SMOKE_KEY ?? process.env.SIRAAT_API_KEY ?? '';

const TEST_RATE_LIMIT = process.argv.includes('--test-rate-limit');

// ── Seeded stable UUIDs (from seed-societies.sql + seed-trust.sql) ────────────
const SOCIETY_ID = 'a1b2c3d4-0001-0001-0001-000000000001';   // Park View City
const PROPERTY_ID = 'b1b2c3d4-0001-0001-0001-000000000001';  // Plot A-14, Park View City
const DEVELOPER_ID = 'd1b2c3d4-0001-0001-0001-000000000001'; // DHA Development Authority

// ── Colours ───────────────────────────────────────────────────────────────────
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[90m·\x1b[0m';

let passed = 0;
let failed = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function request(
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; key?: string | null } = {},
): Promise<{ status: number; body: unknown }> {
  const apiKey = opts.key === undefined ? KEY : opts.key;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ── Test sections ─────────────────────────────────────────────────────────────

async function testRecommendationsFull(): Promise<string | null> {
  console.log('\n[1] POST /v1/market-intelligence/recommendations — covered city → FULL');
  const { status, body } = await request('POST', '/v1/market-intelligence/recommendations', {
    body: { query_text: 'plot in Islamabad under 30 million' },
  });
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('state is FULL or DEGRADED_SUCCESS', b.state === 'FULL' || b.state === 'DEGRADED_SUCCESS');
  assert('recommendations is array', Array.isArray(b.recommendations));

  const recs = b.recommendations as Array<Record<string, unknown>>;
  if (recs.length > 0) {
    const r = recs[0];
    assert('first rec has id', typeof r.id === 'string');
    assert('confidence_score 0–1', typeof r.confidence_score === 'number' && (r.confidence_score as number) <= 1);
    assert('has affiliation_disclosure key', 'affiliation_disclosure' in r);
    assert('has is_stale', typeof r.is_stale === 'boolean');
    return r.id as string;
  } else {
    console.log(`  ${INFO} No recommendations returned (seed data may be empty)`);
    return null;
  }
}

async function testRecommendationsNotCovered(): Promise<void> {
  console.log('\n[2] POST /v1/market-intelligence/recommendations — uncovered city → NOT_COVERED');
  const { status, body } = await request('POST', '/v1/market-intelligence/recommendations', {
    body: { query_text: 'apartment in Karachi near the sea' },
  });
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('state is NOT_COVERED', b.state === 'NOT_COVERED', `got ${String(b.state)}`);
  assert('demand_count is positive number', typeof b.demand_count === 'number' && (b.demand_count as number) >= 1);
  assert('recommendations is empty array', Array.isArray(b.recommendations) && (b.recommendations as unknown[]).length === 0);
}

async function testRecommendationDetail(id: string): Promise<void> {
  console.log(`\n[3] GET /v1/market-intelligence/recommendations/${id.slice(0, 8)}…`);
  const { status, body } = await request('GET', `/v1/market-intelligence/recommendations/${id}`);
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('has confidence_score', typeof b.confidence_score === 'number');
  assert('has evidence_summaries array', Array.isArray(b.evidence_summaries));
  assert('has affiliation_disclosure key', 'affiliation_disclosure' in b);
  assert('record_type is GENERATED', b.record_type === 'GENERATED');
}

async function testPropertyDetail(): Promise<void> {
  console.log(`\n[4] GET /v1/property-intelligence/properties/${PROPERTY_ID.slice(0, 8)}…`);
  const { status, body } = await request('GET', `/v1/property-intelligence/properties/${PROPERTY_ID}`);
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('has id', b.id === PROPERTY_ID);
  assert('has society_id', typeof b.society_id === 'string');
  assert('has price', typeof b.price === 'number');
}

async function testSocietyNocStatus(): Promise<void> {
  console.log(`\n[5] GET /v1/trust/societies/${SOCIETY_ID.slice(0, 8)}…/noc-status`);
  const { status, body } = await request('GET', `/v1/trust/societies/${SOCIETY_ID}/noc-status`);
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('has status field', typeof b.status === 'string');
  assert('has evidence array', Array.isArray(b.evidence));
}

async function testDeveloperVerification(): Promise<void> {
  console.log(`\n[6] GET /v1/trust/developers/${DEVELOPER_ID.slice(0, 8)}…/verification`);
  const { status, body } = await request('GET', `/v1/trust/developers/${DEVELOPER_ID}/verification`);
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('has status field', typeof b.status === 'string');
  assert('has claim', typeof b.claim === 'string');
}

async function testEvidenceSubmission(): Promise<void> {
  console.log('\n[7] POST /v1/trust/evidence-submissions');
  const { status, body } = await request('POST', '/v1/trust/evidence-submissions', {
    body: {
      linked_to: SOCIETY_ID,
      type: 'document',
      source_ref: 'Smoke test submission',
      file_ref: 'smoke-test/placeholder.pdf',
    },
  });
  const b = body as Record<string, unknown>;

  assert('HTTP 201 or 200', status === 201 || status === 200, `got ${status}`);
  assert('status is pending_review', b.status === 'pending_review');
  assert('has submission_id', typeof b.submission_id === 'string');
}

async function testAuth(): Promise<void> {
  console.log('\n[8] Auth — missing key → 403 OBO_PERMISSION_DENIED');
  const { status, body } = await request('POST', '/v1/market-intelligence/recommendations', {
    body: { query_text: 'plot in Islamabad' },
    key: null,
  });
  const b = body as Record<string, unknown>;

  assert('HTTP 403', status === 403, `got ${status}`);
  assert('error_code is OBO_PERMISSION_DENIED', b.error_code === 'OBO_PERMISSION_DENIED');
}

async function testRateLimit(): Promise<void> {
  console.log('\n[9] Rate limit — 61 rapid requests → at least one 429');
  console.log(`  ${INFO} Firing 61 requests (consumes rate quota for ~60s)…`);

  const results = await Promise.all(
    Array.from({ length: 61 }, () =>
      request('POST', '/v1/market-intelligence/recommendations', {
        body: { query_text: 'rate limit test Islamabad' },
      }),
    ),
  );

  const statuses = results.map((r) => r.status);
  const got429 = statuses.some((s) => s === 429);
  const bodies429 = results.filter((r) => r.status === 429).map((r) => r.body as Record<string, unknown>);
  const hasCorrectCode = bodies429.some((b) => b.error_code === 'RATE_LIMIT_EXCEEDED');

  assert('at least one 429 returned', got429, `got statuses: ${[...new Set(statuses)].join(', ')}`);
  if (got429) {
    assert('429 body has RATE_LIMIT_EXCEEDED error_code', hasCorrectCode);
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

async function testHealth(): Promise<void> {
  console.log('\n[0] GET /health — public liveness check');
  const { status, body } = await request('GET', '/health', { key: null });
  const b = body as Record<string, unknown>;

  assert('HTTP 200', status === 200, `got ${status}`);
  assert('status is ok', b.status === 'ok');
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   Siraat QA Smoke Test                           ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Target: ${BASE}`);
  if (!KEY) console.log('  \x1b[33m! SMOKE_KEY not set — auth tests will use empty key\x1b[0m');

  await testHealth();
  await testAuth();
  await testRecommendationsNotCovered();

  const firstRecId = await testRecommendationsFull();
  if (firstRecId) {
    await testRecommendationDetail(firstRecId);
  } else {
    console.log('\n[3] Skipped recommendation detail — no recs returned in step [1]');
  }

  await testPropertyDetail();
  await testSocietyNocStatus();
  await testDeveloperVerification();
  await testEvidenceSubmission();

  if (TEST_RATE_LIMIT) {
    await testRateLimit();
  } else {
    console.log('\n[9] Rate limit test skipped (pass --test-rate-limit to enable)');
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const total = passed + failed;
  console.log('\n──────────────────────────────────────────────────');
  console.log(`Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`\x1b[31m${failed} assertion(s) failed — system is NOT ready\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log('\x1b[32mAll assertions passed — system is alive\x1b[0m\n');
  }
}

main().catch((err: unknown) => {
  console.error('\n✗ Smoke test crashed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
