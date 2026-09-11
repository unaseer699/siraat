import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// WHATSAPP INTEGRATION Phase 2 — HTTP-level check that GET
// /v1/admin/whatsapp-drafts sits behind BearerGuard, same pattern as
// admin-whatsapp-mappings.spec.ts (AdminService fully mocked — delegation
// itself is covered by admin.service.spec.ts).

const API_KEY = 'test-admin-key-whatsapp-drafts';

const DRAFT = {
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
  status: 'PENDING',
  created_at: new Date('2026-01-01'),
};

describe('AdminController — whatsapp-drafts (integration)', () => {
  let app: NestFastifyApplication;
  let listMock: jest.Mock;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    listMock = jest.fn().mockResolvedValue([DRAFT]);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        BearerGuard,
        {
          provide: AdminService,
          useValue: { listWhatsappDrafts: listMock },
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

  function req(url: string, apiKey?: string) {
    return app.inject({
      method: 'GET',
      url,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
  }

  describe('with a valid admin Bearer key', () => {
    it('returns pending drafts', async () => {
      const res = await req('/v1/admin/whatsapp-drafts', API_KEY);

      expect(res.statusCode).toBe(200);
      expect(listMock).toHaveBeenCalledWith(undefined);
      expect(JSON.parse(res.payload)).toEqual([
        { ...DRAFT, created_at: DRAFT.created_at.toISOString() },
      ]);
    });

    it('passes the project_ref query filter through', async () => {
      const res = await req(
        '/v1/admin/whatsapp-drafts?project_ref=aaaaaaaa-0000-0000-0000-000000000001',
        API_KEY,
      );

      expect(res.statusCode).toBe(200);
      expect(listMock).toHaveBeenCalledWith('aaaaaaaa-0000-0000-0000-000000000001');
    });
  });

  describe('without an admin Bearer key', () => {
    it('is rejected with 403 and never reaches AdminService', async () => {
      const res = await req('/v1/admin/whatsapp-drafts');

      expect(res.statusCode).toBe(403);
      expect(listMock).not.toHaveBeenCalled();
    });
  });

  describe('with a wrong admin Bearer key', () => {
    it('is rejected with 403 and never reaches AdminService', async () => {
      const res = await req('/v1/admin/whatsapp-drafts', 'wrong-key');

      expect(res.statusCode).toBe(403);
      expect(listMock).not.toHaveBeenCalled();
    });
  });
});
