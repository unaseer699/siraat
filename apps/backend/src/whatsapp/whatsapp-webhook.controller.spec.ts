import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerModule } from '@nestjs/throttler';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHmac } from 'crypto';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInboundMessageEntity } from './entities/whatsapp-inbound-message.entity';
import { WhatsappProjectMappingEntity } from './entities/whatsapp-project-mapping.entity';

// ─── Configuration ────────────────────────────────────────────────────────────
// Match the production throttle limit from AppModule — see
// recommendations.throttle.spec.ts, the established pattern for this.
const THROTTLE_LIMIT = 60;
const THROTTLE_TTL_MS = 60_000;

const VERIFY_TOKEN = 'test-verify-token-abc123';
const APP_SECRET = 'test-app-secret-xyz789';

const MAPPED_WA_ID = '923001234567';
const UNMAPPED_WA_ID = '923009999999';
const MAPPED_PROJECT_REF = 'proj-0000-0000-0000-00000000000a';

// ─── In-memory repo doubles ──────────────────────────────────────────────────
// Real WhatsappService wired to these, not a mocked WhatsappService — so this
// suite exercises the actual HTTP → controller → service → "storage" pipeline
// (raw body plumbing, HMAC verification, idempotency, mapping lookup) without
// a real Postgres.

function makeInboundRepo() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    findOneBy: jest.fn(async ({ wa_message_id }: { wa_message_id: string }) =>
      rows.find((r) => r.wa_message_id === wa_message_id) ?? null,
    ),
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn(async (entity: Record<string, unknown>) => {
      if (rows.some((r) => r.wa_message_id === entity.wa_message_id)) {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), {
          code: '23505',
        });
      }
      const saved = { id: `msg-${rows.length + 1}`, created_at: new Date(), ...entity };
      rows.push(saved);
      return saved;
    }),
  };
}

function makeMappingRepo() {
  const rows = [
    {
      id: 'map-1',
      wa_id: MAPPED_WA_ID,
      project_ref: MAPPED_PROJECT_REF,
      created_by: 'founder@siraat.pk',
      created_at: new Date(),
    },
  ];
  return {
    rows,
    findOneBy: jest.fn(async ({ wa_id }: { wa_id: string }) => rows.find((r) => r.wa_id === wa_id) ?? null),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function signedBody(body: unknown, secret = APP_SECRET) {
  const payload = JSON.stringify(body);
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  return { payload, signature };
}

function metaTextMessage(wa_id: string, messageId: string, text = 'Cement 10 bags 85000') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              messages: [
                { from: wa_id, id: messageId, timestamp: '1700000000', type: 'text', text: { body: text } },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

async function postWebhook(app: NestFastifyApplication, payload: string, signature?: string) {
  return app.inject({
    method: 'POST',
    url: '/v1/webhooks/whatsapp',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'x-hub-signature-256': signature } : {}),
    },
    payload,
  });
}

async function getVerify(
  app: NestFastifyApplication,
  query: { mode?: string; token?: string; challenge?: string },
) {
  const params = new URLSearchParams();
  if (query.mode !== undefined) params.set('hub.mode', query.mode);
  if (query.token !== undefined) params.set('hub.verify_token', query.token);
  if (query.challenge !== undefined) params.set('hub.challenge', query.challenge);
  return app.inject({ method: 'GET', url: `/v1/webhooks/whatsapp?${params.toString()}` });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('WhatsappWebhookController (integration)', () => {
  let app: NestFastifyApplication;
  let inboundRepo: ReturnType<typeof makeInboundRepo>;
  let mappingRepo: ReturnType<typeof makeMappingRepo>;
  const ORIGINAL_ENV = { ...process.env };

  beforeAll(async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;

    inboundRepo = makeInboundRepo();
    mappingRepo = makeMappingRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: THROTTLE_TTL_MS, limit: THROTTLE_LIMIT }])],
      controllers: [WhatsappWebhookController],
      providers: [
        WhatsappService,
        { provide: getRepositoryToken(WhatsappInboundMessageEntity), useValue: inboundRepo },
        { provide: getRepositoryToken(WhatsappProjectMappingEntity), useValue: mappingRepo },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      // Required for X-Hub-Signature-256 verification — see main.ts.
      rawBody: true,
    });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 20_000);

  afterAll(async () => {
    process.env = { ...ORIGINAL_ENV };
    await app.getHttpAdapter().getInstance().close();
    await app.close();
  });

  afterEach(() => {
    inboundRepo.rows.length = 0;
  });

  // ─── GET verification handshake ────────────────────────────────────────────

  describe('GET /v1/webhooks/whatsapp — verification handshake', () => {
    it('returns hub.challenge for the correct token', async () => {
      const res = await getVerify(app, { mode: 'subscribe', token: VERIFY_TOKEN, challenge: 'challenge-123' });
      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe('challenge-123');
    });

    it('returns 403 for a wrong token', async () => {
      const res = await getVerify(app, { mode: 'subscribe', token: 'wrong', challenge: 'challenge-123' });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 for a missing token', async () => {
      const res = await getVerify(app, { mode: 'subscribe', challenge: 'challenge-123' });
      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST signature validation ──────────────────────────────────────────────

  describe('POST /v1/webhooks/whatsapp — signature validation', () => {
    it('processes and stores the message when the signature is valid', async () => {
      const { payload, signature } = signedBody(metaTextMessage(MAPPED_WA_ID, 'wamid.SIGVALID'));
      const res = await postWebhook(app, payload, signature);

      expect(res.statusCode).toBe(200);
      expect(inboundRepo.rows).toHaveLength(1);
    });

    it('rejects with 401 and stores nothing for an invalid signature', async () => {
      const { payload } = signedBody(metaTextMessage(MAPPED_WA_ID, 'wamid.SIGINVALID'));
      const res = await postWebhook(app, payload, 'sha256=deadbeef');

      expect(res.statusCode).toBe(401);
      expect(inboundRepo.rows).toHaveLength(0);
    });

    it('rejects with 401 and stores nothing for a missing signature header — no fallback', async () => {
      const { payload } = signedBody(metaTextMessage(MAPPED_WA_ID, 'wamid.SIGMISSING'));
      const res = await postWebhook(app, payload, undefined);

      expect(res.statusCode).toBe(401);
      expect(inboundRepo.rows).toHaveLength(0);
    });
  });

  // ─── Idempotency ─────────────────────────────────────────────────────────────

  describe('POST /v1/webhooks/whatsapp — idempotency', () => {
    it('stores the same message id once when delivered twice, and still returns 200 the second time', async () => {
      const { payload, signature } = signedBody(metaTextMessage(MAPPED_WA_ID, 'wamid.DUPLICATE'));

      const first = await postWebhook(app, payload, signature);
      const second = await postWebhook(app, payload, signature);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect(inboundRepo.rows).toHaveLength(1);
    });
  });

  // ─── Mapping resolution ──────────────────────────────────────────────────────

  describe('POST /v1/webhooks/whatsapp — phone → project mapping', () => {
    it('stores an UNMAPPED message for a number with no mapping — not dropped', async () => {
      const { payload, signature } = signedBody(metaTextMessage(UNMAPPED_WA_ID, 'wamid.UNMAPPEDMSG'));
      const res = await postWebhook(app, payload, signature);

      expect(res.statusCode).toBe(200);
      expect(inboundRepo.rows).toEqual([
        expect.objectContaining({ status: 'UNMAPPED', project_ref: null, wa_id: UNMAPPED_WA_ID }),
      ]);
    });

    it('stores a RECEIVED message with the correct project_ref for a mapped number', async () => {
      const { payload, signature } = signedBody(metaTextMessage(MAPPED_WA_ID, 'wamid.MAPPEDMSG'));
      const res = await postWebhook(app, payload, signature);

      expect(res.statusCode).toBe(200);
      expect(inboundRepo.rows).toEqual([
        expect.objectContaining({
          status: 'RECEIVED',
          project_ref: MAPPED_PROJECT_REF,
          wa_id: MAPPED_WA_ID,
        }),
      ]);
    });
  });

  // ─── [SECURITY] No secret/PII leakage in logs ────────────────────────────────

  describe('log output', () => {
    it('never logs the app secret, verify token, or an unmasked phone number', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

      const { payload, signature } = signedBody(metaTextMessage(MAPPED_WA_ID, 'wamid.LOGCHECK'));
      await postWebhook(app, payload, signature);

      const loggedText = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(loggedText).not.toContain(APP_SECRET);
      expect(loggedText).not.toContain(VERIFY_TOKEN);
      expect(loggedText).not.toContain(MAPPED_WA_ID);

      logSpy.mockRestore();
    });
  });

  // Rate limiting is verified in its own file (whatsapp-webhook.throttle.spec.ts)
  // with its own dedicated app/ThrottlerStorage — sharing this file's `app`
  // would mean every POST above already spent part of the window's budget
  // before the throttle test's own loop even starts. Same isolation
  // recommendations.throttle.spec.ts uses relative to the rest of that
  // controller's tests.
});
