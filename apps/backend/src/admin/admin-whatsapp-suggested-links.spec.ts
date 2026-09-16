import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// WHATSAPP INTEGRATION Phase 6b — CONTRACTOR/SUPPLIER MENTION DETECTION
// (REVIEW-GATED). HTTP-level checks that the new whatsapp-suggested-links
// routes sit behind BearerGuard, same pattern as admin-whatsapp-review.spec.ts
// (AdminService fully mocked — delegation itself is covered by
// admin.service.spec.ts, matching/link-creation logic by
// whatsapp-business-link.service.spec.ts).

const API_KEY = 'test-admin-key-whatsapp-suggested-links';

const PENDING_SUGGESTION = {
  id: 'link-uuid-0001',
  draft_expense_id: 'draft-uuid-0001',
  mentioned_name: 'Al-Rehman Traders',
  matched_contractor_id: 'contractor-uuid-0001',
  matched_supplier_id: null,
  status: 'PENDING_REVIEW',
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  created_at: new Date('2026-01-01'),
};

describe('AdminController — whatsapp suggested business links (integration)', () => {
  let app: NestFastifyApplication;
  let listMock: jest.Mock;
  let approveMock: jest.Mock;
  let rejectMock: jest.Mock;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    listMock = jest.fn().mockResolvedValue([PENDING_SUGGESTION]);
    approveMock = jest.fn().mockResolvedValue({ ...PENDING_SUGGESTION, status: 'APPROVED', reviewed_at: new Date() });
    rejectMock = jest.fn().mockResolvedValue({ ...PENDING_SUGGESTION, status: 'REJECTED', reviewed_at: new Date() });

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        BearerGuard,
        {
          provide: AdminService,
          useValue: {
            listWhatsappSuggestedLinks: listMock,
            approveWhatsappSuggestedLink: approveMock,
            rejectWhatsappSuggestedLink: rejectMock,
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

  // ─── GET /v1/admin/whatsapp-suggested-links ────────────────────────────

  describe('GET /v1/admin/whatsapp-suggested-links', () => {
    it('returns PENDING_REVIEW suggestions with a valid admin Bearer key', async () => {
      const res = await req('GET', '/v1/admin/whatsapp-suggested-links', API_KEY);

      expect(res.statusCode).toBe(200);
      expect(listMock).toHaveBeenCalled();
      expect(JSON.parse(res.payload)).toEqual([
        { ...PENDING_SUGGESTION, created_at: PENDING_SUGGESTION.created_at.toISOString() },
      ]);
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('GET', '/v1/admin/whatsapp-suggested-links');
      expect(res.statusCode).toBe(403);
      expect(listMock).not.toHaveBeenCalled();
    });
  });

  // ─── POST /v1/admin/whatsapp-suggested-links/:id/approve ───────────────

  describe('POST /v1/admin/whatsapp-suggested-links/:id/approve', () => {
    it('approves using the auto-match with a valid admin Bearer key and no override', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/approve', API_KEY, {});

      expect(res.statusCode).toBe(200);
      expect(approveMock).toHaveBeenCalledWith('link-uuid-0001', { contractor_id: null, supplier_id: null });
      expect(JSON.parse(res.payload).status).toBe('APPROVED');
    });

    it('passes an override contractor_id through', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/approve', API_KEY, {
        contractor_id: '11111111-1111-1111-1111-111111111111',
      });

      expect(res.statusCode).toBe(200);
      expect(approveMock).toHaveBeenCalledWith('link-uuid-0001', {
        contractor_id: '11111111-1111-1111-1111-111111111111',
        supplier_id: null,
      });
    });

    it('rejects a malformed override id with a 400 before reaching AdminService', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/approve', API_KEY, {
        contractor_id: 'not-a-uuid',
      });

      expect(res.statusCode).toBe(400);
      expect(approveMock).not.toHaveBeenCalled();
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/approve', undefined, {});
      expect(res.statusCode).toBe(403);
      expect(approveMock).not.toHaveBeenCalled();
    });

    it('404s on a non-existent suggestion', async () => {
      approveMock.mockRejectedValueOnce(new NotFoundException('WhatsApp suggested business link missing-uuid not found'));

      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/missing-uuid/approve', API_KEY, {});
      expect(res.statusCode).toBe(404);
    });

    it('propagates a 400 when the suggestion has already been reviewed', async () => {
      approveMock.mockRejectedValueOnce(new BadRequestException('Suggestion link-uuid-0001 cannot be reviewed again'));

      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/approve', API_KEY, {});
      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /v1/admin/whatsapp-suggested-links/:id/reject ────────────────

  describe('POST /v1/admin/whatsapp-suggested-links/:id/reject', () => {
    it('rejects a suggestion and stores the reason with a valid admin Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/reject', API_KEY, {
        reason: 'not a real business',
      });

      expect(res.statusCode).toBe(200);
      expect(rejectMock).toHaveBeenCalledWith('link-uuid-0001', 'not a real business');
      expect(JSON.parse(res.payload).status).toBe('REJECTED');
    });

    it('accepts an omitted reason (optional field, defaults to null)', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/reject', API_KEY, {});

      expect(res.statusCode).toBe(200);
      expect(rejectMock).toHaveBeenCalledWith('link-uuid-0001', null);
    });

    it('is rejected with 403 and never reaches AdminService without a Bearer key', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/link-uuid-0001/reject', undefined, {});
      expect(res.statusCode).toBe(403);
      expect(rejectMock).not.toHaveBeenCalled();
    });

    it('404s on a non-existent suggestion', async () => {
      rejectMock.mockRejectedValueOnce(new NotFoundException('WhatsApp suggested business link missing-uuid not found'));

      const res = await req('POST', '/v1/admin/whatsapp-suggested-links/missing-uuid/reject', API_KEY, {});
      expect(res.statusCode).toBe(404);
    });
  });
});
