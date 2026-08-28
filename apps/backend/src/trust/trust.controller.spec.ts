import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';
import { StorageService } from './storage.service';
import type { VerificationEntity } from './entities/verification.entity';
import type { EvidenceEntity } from './entities/evidence.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SOCIETY_ID = 'c1000000-0000-0000-0000-000000000001';
const DEV_ID = 'd1000000-0000-0000-0000-000000000001';

const EVIDENCE_NOC: EvidenceEntity = {
  id: 'e1000000-0000-0000-0000-000000000001',
  type: 'document',
  file_ref: 'trust/cda/noc-224kanal.pdf',
  source_ref: 'CDA Portal',
  document_date: null,
  document_type: null,
  record_type: 'FACT',
  created_at: new Date('2026-01-10'),
};

const EVIDENCE_NOTICE: EvidenceEntity = {
  id: 'e1000000-0000-0000-0000-000000000002',
  type: 'document',
  file_ref: 'trust/lda/show-cause.pdf',
  source_ref: 'LDA Portal',
  document_date: null,
  document_type: null,
  record_type: 'FACT',
  created_at: new Date('2026-03-01'),
};

const VER_NOC: VerificationEntity = {
  id: 'b1000000-0000-0000-0000-000000000001',
  subject_type: 'SOCIETY',
  subject_id: SOCIETY_ID,
  claim: 'NOC (224 kanal) approved by CDA',
  claim_type: 'NOC',
  status: 'VERIFIED',
  evidence_refs: [EVIDENCE_NOC.id],
  verified_at: new Date('2026-01-15'),
};

const VER_SHOW_CAUSE: VerificationEntity = {
  id: 'b1000000-0000-0000-0000-000000000002',
  subject_type: 'SOCIETY',
  subject_id: SOCIETY_ID,
  claim: 'Blue Bell Block — Illegal Scheme Notice issued by LDA',
  claim_type: 'SHOW_CAUSE_NOTICE',
  status: 'DISPUTED',
  evidence_refs: [EVIDENCE_NOTICE.id],
  verified_at: null,
};

const VER_DEV: VerificationEntity = {
  id: 'b2000000-0000-0000-0000-000000000001',
  subject_type: 'DEVELOPER',
  subject_id: DEV_ID,
  claim: 'SECP-registered entity',
  claim_type: 'PLANNING_APPROVAL',
  status: 'VERIFIED',
  evidence_refs: [],
  verified_at: new Date('2026-02-01'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeModule(getVerificationsMock: jest.Mock) {
  return Test.createTestingModule({
    controllers: [TrustController],
    providers: [
      {
        provide: TrustService,
        useValue: {
          getVerifications: getVerificationsMock,
          getEvidenceById: jest.fn(),
        },
      },
      {
        provide: StorageService,
        useValue: { getPresignedDownloadUrl: jest.fn() },
      },
    ],
  }).compile();
}

// ─── getSocietyNocStatus ─────────────────────────────────────────────────────

describe('TrustController.getSocietyNocStatus', () => {
  it('returns { claims: [...] } with BOTH verification records for a society with NOC + SHOW_CAUSE_NOTICE', async () => {
    const mock = jest.fn().mockResolvedValue([
      { verification: VER_NOC, evidence: [EVIDENCE_NOC] },
      { verification: VER_SHOW_CAUSE, evidence: [EVIDENCE_NOTICE] },
    ]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    const response = await ctrl.getSocietyNocStatus(SOCIETY_ID);

    expect(response).toHaveProperty('claims');
    expect(response.claims).toHaveLength(2);

    const nocClaim = response.claims.find((c) => c.claim_type === 'NOC');
    expect(nocClaim).toBeDefined();
    expect(nocClaim!.status).toBe('VERIFIED');
    expect(nocClaim!.claim).toBe('NOC (224 kanal) approved by CDA');
    expect(nocClaim!.evidence).toHaveLength(1);
    expect(nocClaim!.evidence[0].id).toBe(EVIDENCE_NOC.id);

    const adverseClaim = response.claims.find((c) => c.claim_type === 'SHOW_CAUSE_NOTICE');
    expect(adverseClaim).toBeDefined();
    expect(adverseClaim!.status).toBe('DISPUTED');
    expect(adverseClaim!.claim).toBe('Blue Bell Block — Illegal Scheme Notice issued by LDA');
    expect(adverseClaim!.evidence).toHaveLength(1);
    expect(adverseClaim!.evidence[0].id).toBe(EVIDENCE_NOTICE.id);
  });

  it('includes claim_type in every serialized claim', async () => {
    const mock = jest.fn().mockResolvedValue([
      { verification: VER_NOC, evidence: [] },
    ]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    const response = await ctrl.getSocietyNocStatus(SOCIETY_ID);

    expect(response.claims[0].claim_type).toBe('NOC');
  });

  it('throws NotFoundException when no verification records exist', async () => {
    const mock = jest.fn().mockResolvedValue([]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    await expect(ctrl.getSocietyNocStatus('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('calls getVerifications (not the deprecated getVerification)', async () => {
    const mock = jest.fn().mockResolvedValue([{ verification: VER_NOC, evidence: [] }]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);
    const svc = module.get(TrustService);

    await ctrl.getSocietyNocStatus(SOCIETY_ID);

    expect(svc.getVerifications).toHaveBeenCalledWith('SOCIETY', SOCIETY_ID);
  });

  it('serializes verified_at as ISO string', async () => {
    const mock = jest.fn().mockResolvedValue([{ verification: VER_NOC, evidence: [] }]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    const response = await ctrl.getSocietyNocStatus(SOCIETY_ID);

    expect(response.claims[0].verified_at).toBe(VER_NOC.verified_at!.toISOString());
  });

  it('serializes verified_at as null when not set', async () => {
    const mock = jest.fn().mockResolvedValue([{ verification: VER_SHOW_CAUSE, evidence: [] }]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    const response = await ctrl.getSocietyNocStatus(SOCIETY_ID);

    expect(response.claims[0].verified_at).toBeNull();
  });
});

// ─── getDeveloperVerification ────────────────────────────────────────────────

describe('TrustController.getDeveloperVerification', () => {
  it('returns { claims: [...] } for a developer', async () => {
    const mock = jest.fn().mockResolvedValue([{ verification: VER_DEV, evidence: [] }]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    const response = await ctrl.getDeveloperVerification(DEV_ID);

    expect(response).toHaveProperty('claims');
    expect(response.claims).toHaveLength(1);
    expect(response.claims[0].claim_type).toBe('PLANNING_APPROVAL');
    expect(response.claims[0].status).toBe('VERIFIED');
  });

  it('throws NotFoundException when no records exist for developer', async () => {
    const mock = jest.fn().mockResolvedValue([]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);

    await expect(ctrl.getDeveloperVerification('non-existent')).rejects.toThrow(NotFoundException);
  });

  it('calls getVerifications with DEVELOPER subject type', async () => {
    const mock = jest.fn().mockResolvedValue([{ verification: VER_DEV, evidence: [] }]);
    const module = await makeModule(mock);
    const ctrl = module.get(TrustController);
    const svc = module.get(TrustService);

    await ctrl.getDeveloperVerification(DEV_ID);

    expect(svc.getVerifications).toHaveBeenCalledWith('DEVELOPER', DEV_ID);
  });
});
