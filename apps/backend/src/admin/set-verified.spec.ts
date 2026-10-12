import { BadRequestException } from '@nestjs/common';
import { AdminService, SIRAAT_VERIFIED_CLAIM } from './admin.service';

// AdminService has many collaborators; only the three used here are stubbed.
function build(existing: { id: string; status: string } | null) {
  const calls: string[] = [];
  const svc = Object.create(AdminService.prototype) as AdminService;
  Object.assign(svc, {
    piSvc: { findContractorById: async () => ({ id: 'c1' }), findSupplierById: async () => ({ id: 's1' }) },
    trustSvc: {
      getVerifications: async () =>
        existing ? [{ verification: { id: existing.id, status: existing.status, claim: SIRAAT_VERIFIED_CLAIM, claim_type: 'OTHER' }, evidence: [] }] : [],
      addEvidenceToVerification: async () => void calls.push('evidence'),
      setVerificationStatus: async (_id: string, s: string) => void calls.push(`status:${s}`),
    },
    addClaim: async (d: { target_status: string; evidence: { source_ref: string }[] }) => void calls.push(`claim:${d.target_status}:${d.evidence[0].source_ref}`),
  });
  return { svc, calls };
}

describe('AdminService.setSubjectVerified', () => {
  it('creates a VERIFIED claim carrying the admin note as evidence', async () => {
    const { svc, calls } = build(null);
    await svc.setSubjectVerified('CONTRACTOR', 'c1', true, 'Visited finished house');
    expect(calls).toEqual(['claim:VERIFIED:Visited finished house']);
  });

  it('needs a note to verify', async () => {
    await expect(build(null).svc.setSubjectVerified('SUPPLIER', 's1', true, '  ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unticking cancels an existing verified claim', async () => {
    const { svc, calls } = build({ id: 'v1', status: 'VERIFIED' });
    await svc.setSubjectVerified('CONTRACTOR', 'c1', false);
    expect(calls).toEqual(['status:CANCELLED']);
  });

  it('re-ticking after a cancel adds the new note and restores VERIFIED', async () => {
    const { svc, calls } = build({ id: 'v1', status: 'CANCELLED' });
    await svc.setSubjectVerified('CONTRACTOR', 'c1', true, 'Rechecked');
    expect(calls).toEqual(['evidence', 'status:VERIFIED']);
  });
});
