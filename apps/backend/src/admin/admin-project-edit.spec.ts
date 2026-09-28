import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from '../common/http-exception.filter';
import { BearerGuard } from '../auth/bearer.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

// PROJECT EDIT — HTTP-level check that PATCH /v1/admin/projects/:id sits
// behind BearerGuard, that its Zod schema actually validates/strips at the
// HTTP boundary, and that a 404 from AdminService reaches the client as one —
// same pattern as admin-whatsapp-mappings.spec.ts (a real Fastify app via
// app.inject(), AdminService fully mocked since only the controller/guard/
// pipe wiring is under test here; the actual field-diff and Observation
// logging behavior is covered by construction-project.service.spec.ts, and
// AdminService's own delegation by admin.service.spec.ts).

const API_KEY = 'test-admin-key-project-edit';

const PROJECT_RESULT = {
  id: 'proj-uuid-0001',
  name: 'Bahria 1180',
  property_ref: null,
  owner_contact: '+92 300 1112222',
  start_date: '2026-01-15',
  status: 'ACTIVE',
  record_type: 'FACT',
  city: 'Karachi',
};

describe('AdminController — PATCH /v1/admin/projects/:id (integration)', () => {
  let app: NestFastifyApplication;
  let updateProjectMock: jest.Mock;

  beforeAll(async () => {
    process.env.SIRAAT_API_KEY = API_KEY;

    updateProjectMock = jest.fn().mockResolvedValue(PROJECT_RESULT);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        BearerGuard,
        {
          provide: AdminService,
          useValue: {
            updateProject: updateProjectMock,
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

  function patch(url: string, body: unknown, apiKey?: string) {
    return app.inject({
      method: 'PATCH',
      url,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      payload: JSON.stringify(body),
    });
  }

  it('rejects a request with no Bearer key (403) and never reaches AdminService', async () => {
    const res = await patch('/v1/admin/projects/proj-uuid-0001', { city: 'Karachi' });

    expect(res.statusCode).toBe(403);
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it('updates city with a valid Bearer key', async () => {
    const res = await patch('/v1/admin/projects/proj-uuid-0001', { city: 'Karachi' }, API_KEY);

    expect(res.statusCode).toBe(200);
    expect(updateProjectMock).toHaveBeenCalledWith('proj-uuid-0001', { city: 'Karachi' });
    expect(JSON.parse(res.payload)).toEqual(PROJECT_RESULT);
  });

  it('rejects an empty body with a validation error and never reaches AdminService', async () => {
    const res = await patch('/v1/admin/projects/proj-uuid-0001', {}, API_KEY);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error_code).toBe('VALIDATION_ERROR');
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  // Non-editable fields are silently stripped (z.object's default "strip
  // unknown keys" behavior) rather than causing a hard rejection when at
  // least one editable field is also present — start_date is ignored here,
  // only city reaches AdminService.
  it('ignores a non-editable field (start_date) sent alongside an editable one', async () => {
    const res = await patch(
      '/v1/admin/projects/proj-uuid-0001',
      { city: 'Karachi', start_date: '1999-01-01' },
      API_KEY,
    );

    expect(res.statusCode).toBe(200);
    expect(updateProjectMock).toHaveBeenCalledWith('proj-uuid-0001', { city: 'Karachi' });
  });

  // When a body contains ONLY non-editable fields, stripping leaves nothing —
  // that's indistinguishable from an empty body and is rejected the same way.
  it('rejects a body containing only non-editable fields (property_ref) as a validation error', async () => {
    const res = await patch(
      '/v1/admin/projects/proj-uuid-0001',
      { property_ref: 'aaaaaaaa-0000-0000-0000-000000000001' },
      API_KEY,
    );

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error_code).toBe('VALIDATION_ERROR');
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown project id', async () => {
    updateProjectMock.mockRejectedValueOnce(new NotFoundException('Project non-existent-uuid not found'));

    const res = await patch('/v1/admin/projects/non-existent-uuid', { city: 'Karachi' }, API_KEY);

    expect(res.statusCode).toBe(404);
  });
});
