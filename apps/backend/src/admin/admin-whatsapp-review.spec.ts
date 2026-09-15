import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// WHATSAPP INTEGRATION Phase 4 — ADMIN REVIEW QUEUE. HTTP-level checks that
// the new whatsapp-unmapped / reprocess-unmapped / void / resend-prompt
// routes sit behind BearerGuard, same pattern as admin-whatsapp-mappings.spec.ts
// and admin-whatsapp-drafts.spec.ts (AdminService fully mocked — delegation
// itself is covered by admin.service.spec.ts).

const API_KEY = 'test-admin-key-whatsapp-review';

const UNMAPPED_MESSAGE = {
  id: 'msg-uuid-unmapped-0001',
  wa_message_id: 'wamid.UNMAPPED001',
  wa_id: '923009999999',
  message_type: 'text',
  message_text: 'cement 50 bags 1490',
  wa_timestamp: new Date('2026-01-01'),
  raw_payload: {},
  project_ref: null,
  status: 'UNMAPPED',
  created_at: new Date('2026-01-01'),
};

const VOIDED_DRAFT = {
  id: 'draft-uuid-0001',
  inbound_message_id: 'msg-uuid-0001',
  project_ref: 'aaaaaaaa-0000-0000-0000-000000000001',
  parsed_item: 'cement',
  parsed_quantity: 50,
  parsed_unit: 'bags',
  parsed_rate: 1490,
  parsed_trade_category: 'GENERAL_CONTRACTOR',
  confidence: 'HIGH',
  raw_ai_response: { ok: true },
  status: 'VOID',
  void_reason: 'sender never replied',
  created_at: new Date('2026-01-01'),
};

describe('AdminController — whatsapp review queue (integration)', () => {
  let app: NestFastifyApplication;
  let listUnmappedMock: jest.Mock;
  let reprocessMock: jest.Mock;
  let voidDraftMock: jest.Mock;
  let resendPromptMock: jest.Mock;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    listUnmappedMock = jest.fn().mockResolvedValue([UNMAPPED_MESSAGE]);
    reprocessMock = jest.fn().mockResolvedValue({ reprocessed: 2 });
    voidDraftMock = jest.fn().mockResolvedValue(VOIDED_DRAFT);
    resendPromptMock = jest.fn().mockResolvedValue({ sent: true });

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        BearerGuard,
        {
          provide: AdminService,
          useValue: {
            listUnmappedWhatsappMessages: listUnmappedMock,
            reprocessUnmappedWhatsappMessages: reprocessMock,
            voidWhatsappDraft: voidDraftMock,
            resendWhatsappDraftPrompt: resendPromptMock,
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  function req(method: 'GET' | 'POST', url: string, apiKey?: string, body?: unknown) {
    return app.inject({
      method,
      url,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      payload: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  // ─── GET /v1/admin/whatsapp-unmapped ────────────────────────────────────

  describe('GET /v1/admin/whatsapp-unmapped', () => {
    it('returns only UNMAPPED messages with a valid admin Bearer key', async () => {
      const res = await req('GET', '/v1/admin/whatsapp-unmapped', API_KEY);

      expect(res.statusCode).toBe(200);
      expect(listUnmappedMock).toHaveBeenCalled();
      expect(JSON.parse(res.payload)).toEqual([
        { ...UNMAPPED_MESSAGE, wa_timestamp: UNMAPPED_MESSAGE.wa_timestamp.toISOString(), created_at: UNMAPPED_MESSAGE.created_at.toISOString() },
      ]);
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('GET', '/v1/admin/whatsapp-unmapped');
      expect(res.statusCode).toBe(403);
      expect(listUnmappedMock).not.toHaveBeenCalled();
    });
  });

  // ─── POST /v1/admin/whatsapp-mappings/:id/reprocess-unmapped ───────────

  describe('POST /v1/admin/whatsapp-mappings/:id/reprocess-unmapped', () => {
    it('reprocesses with a valid admin Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-mappings/map-uuid-0001/reprocess-unmapped', API_KEY, {});

      expect(res.statusCode).toBe(200);
      expect(reprocessMock).toHaveBeenCalledWith('map-uuid-0001');
      expect(JSON.parse(res.payload)).toEqual({ reprocessed: 2 });
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-mappings/map-uuid-0001/reprocess-unmapped', undefined, {});
      expect(res.statusCode).toBe(403);
      expect(reprocessMock).not.toHaveBeenCalled();
    });

    it('propagates a 404 for a non-existent mapping', async () => {
      reprocessMock.mockRejectedValueOnce(new NotFoundException('WhatsApp mapping missing-uuid not found'));

      const res = await req('POST', '/v1/admin/whatsapp-mappings/missing-uuid/reprocess-unmapped', API_KEY, {});
      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /v1/admin/whatsapp-drafts/:id/void ───────────────────────────

  describe('POST /v1/admin/whatsapp-drafts/:id/void', () => {
    it('voids a draft and stores the reason with a valid admin Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-drafts/draft-uuid-0001/void', API_KEY, {
        reason: 'sender never replied',
      });

      expect(res.statusCode).toBe(200);
      expect(voidDraftMock).toHaveBeenCalledWith('draft-uuid-0001', 'sender never replied');
      expect(JSON.parse(res.payload).status).toBe('VOID');
    });

    it('accepts an omitted reason (optional field, defaults to null)', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-drafts/draft-uuid-0001/void', API_KEY, {});

      expect(res.statusCode).toBe(200);
      expect(voidDraftMock).toHaveBeenCalledWith('draft-uuid-0001', null);
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-drafts/draft-uuid-0001/void', undefined, {});
      expect(res.statusCode).toBe(403);
      expect(voidDraftMock).not.toHaveBeenCalled();
    });

    it('404s on a non-existent draft', async () => {
      voidDraftMock.mockRejectedValueOnce(new NotFoundException('WhatsApp draft missing-uuid not found'));

      const res = await req('POST', '/v1/admin/whatsapp-drafts/missing-uuid/void', API_KEY, {});
      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /v1/admin/whatsapp-drafts/:id/resend-prompt ──────────────────

  describe('POST /v1/admin/whatsapp-drafts/:id/resend-prompt', () => {
    it('resends the prompt with a valid admin Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-drafts/draft-uuid-0001/resend-prompt', API_KEY, {});

      expect(res.statusCode).toBe(200);
      expect(resendPromptMock).toHaveBeenCalledWith('draft-uuid-0001');
      expect(JSON.parse(res.payload)).toEqual({ sent: true });
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-drafts/draft-uuid-0001/resend-prompt');
      expect(res.statusCode).toBe(403);
      expect(resendPromptMock).not.toHaveBeenCalled();
    });

    it('surfaces an outbound send failure as an error response to the admin, not a silent 200', async () => {
      resendPromptMock.mockRejectedValueOnce(new BadGatewayException('Failed to send the WhatsApp message'));

      const res = await req('POST', '/v1/admin/whatsapp-drafts/draft-uuid-0001/resend-prompt', API_KEY, {});
      expect(res.statusCode).toBe(502);
    });

    it('404s on a non-existent draft', async () => {
      resendPromptMock.mockRejectedValueOnce(new NotFoundException('WhatsApp draft missing-uuid not found'));

      const res = await req('POST', '/v1/admin/whatsapp-drafts/missing-uuid/resend-prompt', API_KEY, {});
      expect(res.statusCode).toBe(404);
    });
  });
});
