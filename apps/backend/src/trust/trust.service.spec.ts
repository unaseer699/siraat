import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrustService } from './trust.service';
import { VerificationEntity } from './entities/verification.entity';
import { EvidenceEntity } from './entities/evidence.entity';
import { EvidenceSubmissionEntity } from './entities/evidence-submission.entity';

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
  let eviCreateMock: jest.Mock;
  let eviSaveMock: jest.Mock;
  let subFindOneMock: jest.Mock;
  let subFindByMock: jest.Mock;
  let subCreateMock: jest.Mock;
  let subSaveMock: jest.Mock;

  beforeEach(async () => {
    verFindOneMock = jest.fn();
    eviFindByMock = jest.fn().mockResolvedValue([]);
    verCreateMock = jest.fn((data) => data);
    verSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'new-ver-uuid', ...entity }),
    );
    eviCreateMock = jest.fn((data) => data);
    eviSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'new-evi-uuid', ...entity }),
    );
    subFindOneMock = jest.fn();
    subFindByMock = jest.fn().mockResolvedValue([]);
    subCreateMock = jest.fn((data) => data);
    subSaveMock = jest.fn((entity) =>
      Promise.resolve({ id: 'new-sub-uuid', ...entity }),
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
            create: eviCreateMock,
            save: eviSaveMock,
          },
        },
        {
          provide: getRepositoryToken(EvidenceSubmissionEntity),
          useValue: {
            findOne: subFindOneMock,
            findOneBy: subFindOneMock,
            findBy: subFindByMock,
            create: subCreateMock,
            save: subSaveMock,
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

  // ─── Capability 4: submitEvidence ────────────────────────────────────────────

  it('submitEvidence creates an EvidenceSubmission with status=pending_review', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_VERIFIED);

    const result = await svc.submitEvidence({
      linked_to: SOCIETY_ID,
      type: 'photo',
      source_ref: 'Photo taken at site, Aug 2026',
      file_ref: 'uploads/user/photo-001.jpg',
    });

    expect(result.status).toBe('pending_review');
    expect(result.submission_id).toBeDefined();
    expect(subCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review', linked_to: SOCIETY_ID }),
    );
    expect(subSaveMock).toHaveBeenCalled();
  });

  it('submitEvidence never directly creates an Evidence row', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_VERIFIED);

    await svc.submitEvidence({
      linked_to: SOCIETY_ID,
      type: 'document',
      source_ref: 'User doc',
      file_ref: 'uploads/user/doc.pdf',
    });

    expect(eviCreateMock).not.toHaveBeenCalled();
    expect(eviSaveMock).not.toHaveBeenCalled();
  });

  it('submitEvidence sets data_classification to UNTRUSTED_DATA by default', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_VERIFIED);

    await svc.submitEvidence({
      linked_to: SOCIETY_ID,
      type: 'document',
      source_ref: 'User doc',
      file_ref: 'uploads/user/doc.pdf',
    });

    expect(subCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data_classification: 'UNTRUSTED_DATA' }),
    );
  });

  it('submitEvidence creates a PENDING Verification when none exists for the society', async () => {
    verFindOneMock.mockResolvedValue(null);

    await svc.submitEvidence({
      linked_to: SOCIETY_ID,
      type: 'receipt',
      source_ref: 'Payment receipt',
      file_ref: 'uploads/user/receipt.pdf',
    });

    expect(verCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject_type: 'SOCIETY', subject_id: SOCIETY_ID, status: 'PENDING' }),
    );
    expect(verSaveMock).toHaveBeenCalled();
  });

  it('submitEvidence does not create duplicate Verification when one already exists', async () => {
    verFindOneMock.mockResolvedValue(VERIFICATION_VERIFIED);

    await svc.submitEvidence({
      linked_to: SOCIETY_ID,
      type: 'photo',
      source_ref: 'Photo',
      file_ref: 'uploads/user/photo.jpg',
    });

    expect(verCreateMock).not.toHaveBeenCalled();
  });

  // ─── Capability 4: reviewSubmission ──────────────────────────────────────────

  const PENDING_SUBMISSION: EvidenceSubmissionEntity = {
    id: 'sub-uuid-0001',
    linked_to: SOCIETY_ID,
    type: 'photo',
    source_ref: 'Photo at site',
    file_ref: 'uploads/user/photo-001.jpg',
    status: 'pending_review',
    submitted_by: null,
    record_type: 'FACT',
    data_classification: 'UNTRUSTED_DATA',
    submitted_at: new Date('2026-08-01'),
    reviewed_at: null,
  };

  it('reviewSubmission accepted: creates real Evidence row', async () => {
    subFindOneMock.mockResolvedValue({ ...PENDING_SUBMISSION });
    verFindOneMock.mockResolvedValue({ ...VERIFICATION_VERIFIED });

    await svc.reviewSubmission('sub-uuid-0001', 'accepted');

    expect(eviCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'photo', source_ref: 'Photo at site' }),
    );
    expect(eviSaveMock).toHaveBeenCalled();
  });

  it('reviewSubmission accepted: appends Evidence id to Verification.evidence_refs', async () => {
    const ver = { ...VERIFICATION_VERIFIED, evidence_refs: ['existing-evi-id'] };
    subFindOneMock.mockResolvedValue({ ...PENDING_SUBMISSION });
    verFindOneMock.mockResolvedValue(ver);
    eviSaveMock.mockResolvedValue({ id: 'new-evi-uuid', type: 'photo' });

    await svc.reviewSubmission('sub-uuid-0001', 'accepted');

    const savedVer = verSaveMock.mock.calls.find(
      (call) => Array.isArray(call[0]?.evidence_refs),
    );
    if (!savedVer) {
      // verSaveMock might be called with the entity directly
      const verCall = verSaveMock.mock.calls[0];
      expect(verCall[0].evidence_refs).toContain('new-evi-uuid');
      expect(verCall[0].evidence_refs).toContain('existing-evi-id');
    } else {
      expect(savedVer[0].evidence_refs).toContain('new-evi-uuid');
    }
  });

  it('reviewSubmission accepted: sets submission status to accepted', async () => {
    subFindOneMock.mockResolvedValue({ ...PENDING_SUBMISSION });
    verFindOneMock.mockResolvedValue({ ...VERIFICATION_VERIFIED });

    await svc.reviewSubmission('sub-uuid-0001', 'accepted');

    const subSaveCall = subSaveMock.mock.calls[0][0];
    expect(subSaveCall.status).toBe('accepted');
    expect(subSaveCall.reviewed_at).not.toBeNull();
  });

  it('reviewSubmission rejected: does NOT create an Evidence row', async () => {
    subFindOneMock.mockResolvedValue({ ...PENDING_SUBMISSION });

    await svc.reviewSubmission('sub-uuid-0001', 'rejected');

    expect(eviCreateMock).not.toHaveBeenCalled();
    expect(eviSaveMock).not.toHaveBeenCalled();
  });

  it('reviewSubmission rejected: sets submission status to rejected', async () => {
    subFindOneMock.mockResolvedValue({ ...PENDING_SUBMISSION });

    await svc.reviewSubmission('sub-uuid-0001', 'rejected');

    const subSaveCall = subSaveMock.mock.calls[0][0];
    expect(subSaveCall.status).toBe('rejected');
  });

  it('reviewSubmission throws 404 for unknown submission id', async () => {
    subFindOneMock.mockResolvedValue(null);

    await expect(svc.reviewSubmission('non-existent', 'accepted')).rejects.toThrow(NotFoundException);
  });

  // ─── Capability 4: getVerification unaffected by pending submission ───────────

  it('getVerification confidence is unaffected by a pending submission (structural isolation)', async () => {
    // Pending submission exists in sub repo but getVerification only reads verRepo+eviRepo
    verFindOneMock.mockResolvedValue(VERIFICATION_VERIFIED);
    eviFindByMock.mockResolvedValue([EVIDENCE_1, EVIDENCE_2]);
    subFindByMock.mockResolvedValue([PENDING_SUBMISSION]);

    const result = await svc.getVerification('SOCIETY', SOCIETY_ID);

    // evidence_refs unchanged — submission not in evidence list
    expect(result!.evidence).toHaveLength(2);
    expect(result!.evidence.map((e) => e.id)).not.toContain('sub-uuid-0001');
  });
});
