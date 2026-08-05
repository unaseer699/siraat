import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrustService } from './trust.service';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';

const SOCIETY_ID = 'a1b2c3d4-0001-0001-0001-000000000001';
const DEV_ID_VERIFIED = 'd1b2c3d4-0001-0001-0001-000000000001';
const DEV_ID_PENDING = 'd1b2c3d4-0002-0002-0002-000000000002';

const EVIDENCE_1: EvidenceEntity = {
  id: 'e1b2c3d4-0001-0001-0001-000000000001',
  type: 'document',
  file_ref: 'trust/pvc/noc-cda.pdf',
  source_ref: 'CDA Portal',
  record_type: 'FACT',
  created_at: new Date('2026-01-01'),
};

const EVIDENCE_2: EvidenceEntity = {
  id: 'e1b2c3d4-0001-0001-0001-000000000002',
  type: 'document',
  file_ref: 'trust/pvc/layout.pdf',
  source_ref: 'CDA Portal — Layout',
  record_type: 'FACT',
  created_at: new Date('2026-01-02'),
};

const VERIFICATION_VERIFIED: VerificationEntity = {
  id: 'b1b2c3d4-0001-0001-0001-000000000001',
  subject_type: 'SOCIETY',
  subject_id: SOCIETY_ID,
  claim: 'NOC Approved by CDA',
  status: 'VERIFIED',
  evidence_refs: [EVIDENCE_1.id, EVIDENCE_2.id],
  verified_at: new Date('2026-01-15'),
};

const VERIFICATION_PENDING: VerificationEntity = {
  id: 'b2b2c3d4-0002-0002-0002-000000000002',
  subject_type: 'DEVELOPER',
  subject_id: DEV_ID_PENDING,
  claim: 'Verified registered developer',
  status: 'PENDING',
  evidence_refs: [],
  verified_at: null,
};

const VERIFICATION_DEV_VERIFIED: VerificationEntity = {
  id: 'b2b2c3d4-0001-0001-0001-000000000001',
  subject_type: 'DEVELOPER',
  subject_id: DEV_ID_VERIFIED,
  claim: 'Verified registered developer',
  status: 'VERIFIED',
  evidence_refs: ['e2b2c3d4-0001-0001-0001-000000000001'],
  verified_at: new Date('2026-02-01'),
};

const DEV_EVIDENCE: EvidenceEntity = {
  id: 'e2b2c3d4-0001-0001-0001-000000000001',
  type: 'document',
  file_ref: 'trust/dha/registration-cert.pdf',
  source_ref: 'NAPHDA — Developer Registration Certificate',
  record_type: 'FACT',
  created_at: new Date('2026-02-01'),
};

describe('TrustService', () => {
  let svc: TrustService;
  let verFindOneMock: jest.Mock;
  let eviFindByMock: jest.Mock;
  let verCreateMock: jest.Mock;
  let verSaveMock: jest.Mock;

  beforeEach(async () => {
    verFindOneMock = jest.fn();
    eviFindByMock = jest.fn().mockResolvedValue([]);
    verCreateMock = jest.fn((data) => data);
    verSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'new-ver-uuid', ...entity }),
    );

    const module = await Test.createTestingModule({
      providers: [
        TrustService,
        {
          provide: getRepositoryToken(VerificationEntity),
          useValue: {
            findOne: verFindOneMock,
            findOneBy: jest.fn(),
            create: verCreateMock,
            save: verSaveMock,
          },
        },
        {
          provide: getRepositoryToken(EvidenceEntity),
          useValue: {
            findBy: eviFindByMock,
            findOneBy: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    svc = module.get(TrustService);
  });

  // ─── getVerification ─────────────────────────────────────────────────────────

  it('returns null when no verification exists for the subject', async () => {
    verFindOneMock.mockResolvedValue(null);
    const result = await svc.getVerification('SOCIETY', 'non-existent-uuid');
    expect(result).toBeNull();
  });

  it('returns verification and evidence for a VERIFIED society', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_VERIFIED);
    eviFindByMock.mockResolvedValue([EVIDENCE_1, EVIDENCE_2]);

    const result = await svc.getVerification('SOCIETY', SOCIETY_ID);

    expect(result).not.toBeNull();
    expect(result!.verification.status).toBe('VERIFIED');
    expect(result!.evidence).toHaveLength(2);
    expect(result!.evidence.map((e) => e.id)).toContain(EVIDENCE_1.id);
  });

  it('returns empty evidence list for PENDING verification', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_PENDING);

    const result = await svc.getVerification('DEVELOPER', DEV_ID_PENDING);

    expect(result).not.toBeNull();
    expect(result!.verification.status).toBe('PENDING');
    expect(result!.evidence).toHaveLength(0);
    expect(eviFindByMock).not.toHaveBeenCalled();
  });

  it('returns VERIFIED status for verified developer', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_DEV_VERIFIED);
    eviFindByMock.mockResolvedValue([DEV_EVIDENCE]);

    const result = await svc.getVerification('DEVELOPER', DEV_ID_VERIFIED);

    expect(result!.verification.status).toBe('VERIFIED');
    expect(result!.evidence).toHaveLength(1);
  });

  it('returns PENDING status for pending developer', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_PENDING);

    const result = await svc.getVerification('DEVELOPER', DEV_ID_PENDING);

    expect(result!.verification.status).toBe('PENDING');
  });

  // ─── createVerification ───────────────────────────────────────────────────────

  it('rejects VERIFIED status with empty evidence_refs', async () => {
    await expect(
      svc.createVerification({
        subject_type: 'SOCIETY',
        subject_id: 'some-uuid',
        claim: 'NOC Approved',
        status: 'VERIFIED',
        evidence_refs: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts VERIFIED status when evidence_refs contains at least one entry', async () => {
    await expect(
      svc.createVerification({
        subject_type: 'SOCIETY',
        subject_id: 'some-uuid',
        claim: 'NOC Approved',
        status: 'VERIFIED',
        evidence_refs: ['evi-001'],
      }),
    ).resolves.toBeDefined();
  });

  it('accepts PENDING status with empty evidence_refs', async () => {
    await expect(
      svc.createVerification({
        subject_type: 'DEVELOPER',
        subject_id: 'some-dev-uuid',
        claim: 'Verified developer',
        status: 'PENDING',
        evidence_refs: [],
      }),
    ).resolves.toBeDefined();
  });

  it('sets verified_at to non-null for VERIFIED, null for PENDING', async () => {
    await svc.createVerification({
      subject_type: 'SOCIETY',
      subject_id: 'some-uuid',
      claim: 'NOC',
      status: 'VERIFIED',
      evidence_refs: ['evi-001'],
    });
    const verifiedCreated = verCreateMock.mock.calls[0][0];
    expect(verifiedCreated.verified_at).not.toBeNull();

    verCreateMock.mockClear();

    await svc.createVerification({
      subject_type: 'SOCIETY',
      subject_id: 'other-uuid',
      claim: 'NOC',
      status: 'PENDING',
      evidence_refs: [],
    });
    const pendingCreated = verCreateMock.mock.calls[0][0];
    expect(pendingCreated.verified_at).toBeNull();
  });
});
