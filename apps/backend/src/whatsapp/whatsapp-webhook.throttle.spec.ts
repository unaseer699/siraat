import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';

// ─── Configuration ────────────────────────────────────────────────────────────
// Match the production throttle limit from AppModule so this test is coupled
// to the real behaviour, not a convenient small number. Same pattern as
// recommendations.throttle.spec.ts — a dedicated file/app instance so no
// other test's requests eat into this window's budget before the loop below.
const THROTTLE_LIMIT = 60;
const THROTTLE_TTL_MS = 60_000;

const APP_SECRET = 'test-app-secret-throttle';
const WA_ID = '923005555555';

function signedBody(body: unknown) {
  const payload = JSON.stringify(body);
  const signature = `sha256=${createHmac('sha256', APP_SECRET).update(payload).digest('hex')}`;
  return { payload, signature };
}

async function postWebhook(app: NestFastifyApplication, payload: string, signature: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/webhooks/whatsapp',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
    payload,
  });
}

describe('WhatsappWebhookController — rate limiting (integration)', () => {
  let app: NestFastifyApplication;
  const ORIGINAL_ENV = { ...process.env };

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }])],
      controllers: [WhatsappWebhookController],
      providers: [
        WhatsappService,
        {
          provide: getRepositoryToken(WhatsappInboundMessageEntity),
          useValue: {
            findOneBy: jest.fn().mockResolvedValue(null),
            create: jest.fn((data: unknown) => data),
            save: jest.fn(async (entity: Record<string, unknown>) => ({ id: 'msg-id', created_at: new Date(), ...entity })),
          },
        },
        {
          provide: getRepositoryToken(WhatsappProjectMappingEntity),
          useValue: { findOneBy: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { rawBody: true });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 20_000);

  afterAll(async () => {
    process.env = { ...ORIGINAL_ENV };
    await app.getHttpAdapter().getInstance().close();
    await app.close();
  });

  // Every request reuses the same signed payload/message id — some of these
  // will no-op as idempotent duplicates after the first, which is fine: only
  // the HTTP status code (never 429 until the limit) is under test here.
  it(`allows ${THROTTLE_LIMIT} requests within the window then returns 429 on the next`, async () => {
    const { payload, signature } = signedBody({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: WA_ID, id: 'wamid.THROTTLE', timestamp: '1700000000', type: 'text', text: { body: 'x' } }],
              },
            },
          ],
        },
      ],
    });

    for (let i = 1; i <= THROTTLE_LIMIT; i++) {
      const res = await postWebhook(app, payload, signature);
      expect(res.statusCode).not.toBe(429);
    }

    const overLimitRes = await postWebhook(app, payload, signature);
    expect(overLimitRes.statusCode).toBe(429);

    const body = JSON.parse(overLimitRes.payload) as Record<string, unknown>;
    expect(body.error_code).toBe('RATE_LIMIT_EXCEEDED');
  }, 30_000);
});
