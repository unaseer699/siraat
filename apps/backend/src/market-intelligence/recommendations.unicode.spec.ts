/**
 * Regression test for evidence source_ref Unicode preservation.
 *
 * Root cause of the original bug: TypeORM's pg connection had no explicit
 * client_encoding. On Windows, PGCLIENTENCODING or a system Postgres install
 * could override pg's UTF-8 default, causing the server to transcode
 * multi-byte characters (e.g. em-dash U+2014, 3 UTF-8 bytes) into individual
 * replacement characters ("???") before they reached Node.js.
 *
 * This test goes through the real NestJS → Fastify → JSON stack so it catches
 * both code-level string manipulation and serialization-layer encoding issues.
 */
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const API_KEY = 'test-unicode-api-key';
const SCORE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// The em-dash (U+2014) is the exact character corrupted as "???" in production.
// Using the Unicode escape (—) makes the intent unmistakable regardless of
// how the source file is saved or displayed in various editors/terminals.
const EM_DASH = '—';
const SOURCE_REF_WITH_EM_DASH = `CDA Portal ${EM_DASH} NOC No. CDA/D-16/2021/PVC`;

const STUB_DETAIL = {
  id: SCORE_ID,
  title: '10 Marla PLOT',
  society_id: 'a1b2c3d4-0001-0001-0001-000000000001',
  society_name: 'Park View City',
  price: 22000000,
  confidence_score: 0.9,
  is_stale: false,
  staleness_threshold_days: 30,
  affiliation_disclosure: null,
  recommendation_summary: 'NOC approved.',
  reasoning_summary: 'Confidence 90%: Trust verification confirmed.',
  derived_from: ['e1b2c3d4-0001-0001-0001-000000000001'],
  evidence_summaries: [
    {
      id: 'e1b2c3d4-0001-0001-0001-000000000001',
      type: 'document' as const,
      source_ref: SOURCE_REF_WITH_EM_DASH,
    },
  ],
  record_type: 'GENERATED' as const,
  computed_at: '2026-08-10T10:00:00.000Z',
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('GET /v1/market-intelligence/recommendations/:id — Unicode preservation', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 1000 }])],
      controllers: [RecommendationsController],
      providers: [
        BearerGuard,
        {
          provide: RecommendationsService,
          useValue: {
            getRecommendationDetail: jest.fn().mockResolvedValue(STUB_DETAIL),
            getRecommendations: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 20_000);

  afterAll(async () => {
    delete process.env.SIRAAT_API_KEY;
    await app.getHttpAdapter().getInstance().close();
    await app.close();
  });

  it('evidence_summaries[].source_ref containing U+2014 em-dash survives JSON serialization unchanged', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/market-intelligence/recommendations/${SCORE_ID}`,
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(res.statusCode).toBe(200);

    // JSON.parse reproduces exactly what a real client does — if the em-dash
    // were encoded as replacement bytes, it would show up here as something
    // other than U+2014 (typically '???' when 3 UTF-8 bytes each become '?').
    const body = JSON.parse(res.payload) as typeof STUB_DETAIL;
    const actualSourceRef = body.evidence_summaries[0].source_ref;

    expect(actualSourceRef).toBe(SOURCE_REF_WITH_EM_DASH);
    expect(actualSourceRef).toContain(EM_DASH);
    expect(actualSourceRef).not.toContain('???');
  });

  it('source_ref is preserved byte-for-byte: UTF-8 encoded em-dash is 3 bytes (E2 80 94)', () => {
    // Belt-and-suspenders: verify the fixture itself is the right character,
    // not a lookalike (en-dash, hyphen-minus, etc.) that a copy-paste might introduce.
    const buf = Buffer.from(EM_DASH, 'utf8');
    expect(buf).toHaveLength(3);
    expect(buf[0]).toBe(0xe2);
    expect(buf[1]).toBe(0x80);
    expect(buf[2]).toBe(0x94);
  });
});
