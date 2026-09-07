import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// WHATSAPP INTEGRATION Phase 1 — HTTP-level check that the new
// whatsapp-mappings admin routes actually sit behind BearerGuard (same
// pattern as recommendations.throttle.spec.ts's guard-behaviour tests: a
// real Fastify app via app.inject(), AdminService fully mocked since only
// the guard wiring is under test here — delegation itself is covered by
// admin.service.spec.ts).

const API_KEY = 'test-admin-key-whatsapp-mappings';

const MAPPING_RESULT = {
  id: 'map-uuid-0001',
  wa_id: '923001234567',
  project_ref: 'aaaaaaaa-0000-0000-0000-000000000001',
  created_by: 'founder@siraat.pk',
  created_at: new Date('2026-01-01'),
};

describe('AdminController — whatsapp-mappings (integration)', () => {
  let app: NestFastifyApplication;
  let createMock: jest.Mock;
  let listMock: jest.Mock;
  let deleteMock: jest.Mock;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    createMock = jest.fn().mockResolvedValue(MAPPING_RESULT);
    listMock = jest.fn().mockResolvedValue([MAPPING_RESULT]);
    deleteMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        BearerGuard,
        {
          provide: AdminService,
          useValue: {
            createWhatsappMapping: createMock,
            listWhatsappMappings: listMock,
            deleteWhatsappMapping: deleteMock,
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

  // Mocks are shared across every `it()` in this file (one `app` for the
  // whole suite, per the recommendations.throttle.spec.ts pattern) — clear
  // call history between tests so `.not.toHaveBeenCalled()` in the
  // "without a Bearer key" block isn't tripped by an earlier authenticated
  // test's call to the same mock.
  afterEach(() => {
    jest.clearAllMocks();
  });

  function req(method: 'POST' | 'GET' | 'DELETE', url: string, apiKey?: string) {
    return app.inject({
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      payload:
        method === 'POST'
          ? JSON.stringify({ wa_id: '923001234567', project_ref: 'aaaaaaaa-0000-0000-0000-000000000001', created_by: 'founder@siraat.pk' })
          : undefined,
    });
  }

  describe('with a valid admin Bearer key', () => {
    it('POST creates a mapping', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-mappings', API_KEY);
      expect(res.statusCode).toBe(201);
      expect(createMock).toHaveBeenCalledWith({
        wa_id: '923001234567',
        project_ref: 'aaaaaaaa-0000-0000-0000-000000000001',
        created_by: 'founder@siraat.pk',
      });
    });

    it('GET lists mappings', async () => {
      const res = await req('GET', '/v1/admin/whatsapp-mappings', API_KEY);
      expect(res.statusCode).toBe(200);
      expect(listMock).toHaveBeenCalled();
      expect(JSON.parse(res.payload)).toEqual([
        { ...MAPPING_RESULT, created_at: MAPPING_RESULT.created_at.toISOString() },
      ]);
    });

    it('DELETE removes a mapping', async () => {
      const res = await req('DELETE', '/v1/admin/whatsapp-mappings/map-uuid-0001', API_KEY);
      expect(res.statusCode).toBe(204);
      expect(deleteMock).toHaveBeenCalledWith('map-uuid-0001');
    });
  });

  describe('without an admin Bearer key', () => {
    it('POST is rejected and never reaches AdminService', async () => {
      const res = await req('POST', '/v1/admin/whatsapp-mappings');
      expect(res.statusCode).toBe(403);
      expect(createMock).not.toHaveBeenCalled();
    });

    it('GET is rejected and never reaches AdminService', async () => {
      const res = await req('GET', '/v1/admin/whatsapp-mappings');
      expect(res.statusCode).toBe(403);
      expect(listMock).not.toHaveBeenCalled();
    });

    it('DELETE is rejected and never reaches AdminService', async () => {
      const res = await req('DELETE', '/v1/admin/whatsapp-mappings/map-uuid-0001');
      expect(res.statusCode).toBe(403);
      expect(deleteMock).not.toHaveBeenCalled();
    });
  });
});
