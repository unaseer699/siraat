import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

// ─── Configuration ────────────────────────────────────────────────────────────
// Match the production throttle limit from AppModule so this test is coupled to
// the real behaviour, not a convenient small number.
const THROTTLE_LIMIT = 60;
const THROTTLE_TTL_MS = 60_000;

const API_KEY = 'test-throttle-key-abc123';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function postRecommendation(
  app: NestFastifyApplication,
  apiKey?: string,
) {
  return app.inject({
    method: 'POST',
    url: '/v1/market-intelligence/recommendations',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    payload: JSON.stringify({ query_text: 'plot in Islamabad' }),
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('RecommendationsController — rate limiting (integration)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }]),
      ],
      controllers: [RecommendationsController],
      providers: [
        BearerGuard,
        {
          provide: RecommendationsService,
          useValue: {
            getRecommendations: jest.fn().mockResolvedValue({
              state: 'FULL',
              recommendations: [],
            }),
            getRecommendationDetail: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    // Fastify must finish registering routes before inject() reaches handlers
    await app.getHttpAdapter().getInstance().ready();
  }, 20_000);

  afterAll(async () => {
    delete process.env.SIRAAT_API_KEY;
    // Close Fastify before NestJS teardown to flush pending timers (throttler storage)
    await app.getHttpAdapter().getInstance().close();
    await app.close();
  });

  // Hit the endpoint exactly THROTTLE_LIMIT times — every request should succeed.
  // Then the very next request should be rejected with 429.
  it(`allows ${THROTTLE_LIMIT} requests within the window then returns 429 on the next`, async () => {
    for (let i = 1; i <= THROTTLE_LIMIT; i++) {
      const res = await postRecommendation(app, API_KEY);
      expect(res.statusCode).not.toBe(429);
    }

    const overLimitRes = await postRecommendation(app, API_KEY);
    expect(overLimitRes.statusCode).toBe(429);

    const body = JSON.parse(overLimitRes.payload) as Record<string, unknown>;
    expect(body.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(typeof body.message).toBe('string');
  }, 30_000);

  it('returns 403 OBO_PERMISSION_DENIED for a missing API key (BearerGuard runs before ThrottlerGuard)', async () => {
    // BearerGuard is first in @UseGuards(BearerGuard, ThrottlerGuard).
    // A missing key must be rejected with 403 before ThrottlerGuard can produce 429 —
    // even though we are already past the throttle limit from the previous test.
    const res = await postRecommendation(app, undefined);
    expect(res.statusCode).toBe(403);

    const body = JSON.parse(res.payload) as Record<string, unknown>;
    expect(body.error_code).toBe('OBO_PERMISSION_DENIED');
  });
});
