'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  addClaimToContractor,
  fetchContractorVerifications,
  type AdminEvidenceItem,
  type ClaimType,
  type VerificationResponse,
} from '@/lib/api';
import { EvidenceEditor } from '../../../EvidenceEditor';
import { ExistingClaimsList } from '../../../ExistingClaimsList';
import { CLAIM_TYPE_OPTIONS, fieldGroupStyle, inputStyle, labelStyle } from '../../../constants';

type TargetStatus = 'VERIFIED' | 'DISPUTED' | 'PENDING';

export default function AddClaimPage() {
  const params = useParams();
  const contractorId = params.id as string;

  const [claimType, setClaimType] = useState<ClaimType>('OTHER');
  const [claim, setClaim] = useState('');
  const [targetStatus, setTargetStatus] = useState<TargetStatus>('PENDING');
  const [evidence, setEvidence] = useState<AdminEvidenceItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ verification_id: string } | null>(null);

  // ADD EVIDENCE TO EXISTING CLAIM — see society/[id]/add-claim/page.tsx.
  const [existingClaims, setExistingClaims] = useState<VerificationResponse[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(true);

  function loadExistingClaims() {
    setClaimsLoading(true);
    fetchContractorVerifications(contractorId)
      .then((data) => setExistingClaims(data.claims))
      .catch(() => setExistingClaims([]))
      .finally(() => setClaimsLoading(false));
  }

  useEffect(() => {
    loadExistingClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorId]);

  const evidenceOk = targetStatus !== 'VERIFIED' || evidence.length > 0;
  const canSubmit = claim.trim().length > 0 && evidenceOk;
  const evidenceRequired = targetStatus === 'VERIFIED';
  const showEvidence = targetStatus === 'VERIFIED' || targetStatus === 'DISPUTED';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await addClaimToContractor(contractorId, {
        claim: claim.trim(),
        claim_type: claimType,
        target_status: targetStatus,
        evidence: showEvidence ? evidence : [],
      });
      setResult(res);
      loadExistingClaims();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <article style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Link href="/admin/new-contractor" style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to contractors
        </Link>

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Add Claim</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Adds an additional verification claim to contractor <code>{contractorId}</code>.
          </p>
        </div>

        {claimsLoading ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading existing claims…</p>
        ) : (
          <ExistingClaimsList claims={existingClaims} onEvidenceAdded={loadExistingClaims} />
        )}

        {result ? (
          <div
            style={{
              padding: '20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius)',
              color: '#166534',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            Claim added
            <p style={{ fontSize: '13px', fontWeight: 400, color: '#166534' }}>
              Verification ID: {result.verification_id}
            </p>
            <div style={{ display: 'flex', gap: '12px', fontWeight: 600 }}>
              <Link href={`/admin/contractor/${contractorId}/add-claim`} onClick={() => setResult(null)} style={{ fontSize: '13px' }}>
                Add another claim →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Claim type</label>
              <select value={claimType} onChange={(e) => setClaimType(e.target.value as ClaimType)} style={inputStyle}>
                {CLAIM_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Claim description</label>
              <input
                type="text"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                placeholder='e.g. "PEC Licensed Contractor"'
                required
                style={inputStyle}
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Verification status</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as TargetStatus)}
                style={inputStyle}
              >
                <option value="PENDING">PENDING</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="DISPUTED">DISPUTED</option>
              </select>
            </div>

            {showEvidence && (
              <>
                <EvidenceEditor items={evidence} onChange={setEvidence} required={evidenceRequired} />
                {!evidenceOk && (
                  <p style={{ fontSize: '12px', color: 'var(--error)' }}>
                    VERIFIED status requires at least one evidence item.
                  </p>
                )}
              </>
            )}

            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius)',
                  color: 'var(--error)',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              style={{
                padding: '12px 20px',
                background: submitting || !canSubmit ? 'var(--muted)' : '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Adding…' : 'Add claim'}
            </button>
          </form>
        )}
      </article>
    </main>
  );
}
