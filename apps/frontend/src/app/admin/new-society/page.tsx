'use client';

import { Suspense, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createSociety, type AdminEvidenceItem, type ClaimType } from '@/lib/api';
import { EvidenceEditor } from '../EvidenceEditor';
import {
  CLAIM_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  fieldGroupStyle,
  inputStyle,
  labelStyle,
} from '../constants';

function optionalNumber(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function NewSocietyForm() {
  const params = useSearchParams();

  const [name, setName] = useState(params.get('name') ?? '');
  const [city, setCity] = useState(params.get('city') ?? '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minAreaMarla, setMinAreaMarla] = useState('');
  const [maxAreaMarla, setMaxAreaMarla] = useState('');
  const [propertyTypes, setPropertyTypes] = useState<string[]>(['PLOT']);
  const [nocApproved, setNocApproved] = useState(false);
  const [baseConfidence, setBaseConfidence] = useState('0.85');
  const [isAffiliated, setIsAffiliated] = useState(false);
  const [affiliationDisclosure, setAffiliationDisclosure] = useState('');
  const [nocSummary, setNocSummary] = useState('');
  const [claim, setClaim] = useState('');
  const [claimType, setClaimType] = useState<ClaimType>('NOC');
  const [targetStatus, setTargetStatus] = useState<'VERIFIED' | 'PENDING'>('PENDING');
  const [evidence, setEvidence] = useState<AdminEvidenceItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    society_id: string;
    verification_id: string;
    candidate_marked_onboarded: boolean;
  } | null>(null);

  function toggleType(t: string) {
    setPropertyTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const confidenceNum = Number(baseConfidence);
  const confidenceValid = Number.isFinite(confidenceNum) && confidenceNum >= 0 && confidenceNum <= 1;
  const evidenceOk = targetStatus !== 'VERIFIED' || evidence.length > 0;
  const affiliationOk = !isAffiliated || affiliationDisclosure.trim().length > 0;
  const canSubmit =
    name.trim() && city.trim() && claim.trim() && confidenceValid && evidenceOk && affiliationOk;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createSociety({
        name: name.trim(),
        city: city.trim(),
        min_price: optionalNumber(minPrice),
        max_price: optionalNumber(maxPrice),
        min_area_marla: optionalNumber(minAreaMarla),
        max_area_marla: optionalNumber(maxAreaMarla),
        property_types: propertyTypes.length > 0 ? propertyTypes : ['PLOT'],
        noc_approved: nocApproved,
        base_confidence: confidenceNum,
        is_siraat_affiliated: isAffiliated,
        affiliation_disclosure: isAffiliated ? affiliationDisclosure.trim() : null,
        noc_summary: nocSummary.trim() || null,
        claim: claim.trim(),
        claim_type: claimType,
        target_status: targetStatus,
        evidence,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <article style={{ maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Link href="/admin/candidates" style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to candidate societies
        </Link>

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Onboard Society</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Creates one Society plus its first Verification claim (and Evidence, if any).
          </p>
        </div>

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
            Society onboarded
            <p style={{ fontSize: '13px', fontWeight: 400, color: '#166534' }}>
              Society ID: {result.society_id}
              <br />
              Verification ID: {result.verification_id || '(none — status PENDING)'}
              <br />
              Candidate marked onboarded: {result.candidate_marked_onboarded ? 'Yes' : 'No matching candidate found'}
            </p>
            <div style={{ display: 'flex', gap: '12px', fontWeight: 600 }}>
              <Link href={`/admin/society/${result.society_id}/add-claim`} style={{ fontSize: '13px' }}>
                Add another claim →
              </Link>
              <Link href={`/society/${result.society_id}`} style={{ fontSize: '13px' }}>
                View society profile →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Society</legend>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>City</label>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required style={inputStyle} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Min price (PKR)</label>
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Max price (PKR)</label>
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Min area (marla)</label>
                  <input type="number" value={minAreaMarla} onChange={(e) => setMinAreaMarla(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Max area (marla)</label>
                  <input type="number" value={maxAreaMarla} onChange={(e) => setMaxAreaMarla(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Property types</label>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  {PROPERTY_TYPE_OPTIONS.map((t) => (
                    <label key={t} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input type="checkbox" checked={propertyTypes.includes(t)} onChange={() => toggleType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={nocApproved} onChange={(e) => setNocApproved(e.target.checked)} />
                NOC approved
              </label>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>NOC summary (optional)</label>
                <textarea
                  value={nocSummary}
                  onChange={(e) => setNocSummary(e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Base confidence (0.0–1.0)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={baseConfidence}
                  onChange={(e) => setBaseConfidence(e.target.value)}
                  required
                  style={inputStyle}
                />
                {!confidenceValid && (
                  <p style={{ fontSize: '12px', color: 'var(--error)' }}>Must be between 0.0 and 1.0.</p>
                )}
              </div>

              <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={isAffiliated} onChange={(e) => setIsAffiliated(e.target.checked)} />
                Siraat-affiliated
              </label>

              {isAffiliated && (
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Affiliation disclosure</label>
                  <input
                    type="text"
                    value={affiliationDisclosure}
                    onChange={(e) => setAffiliationDisclosure(e.target.value)}
                    placeholder="Required when Siraat-affiliated"
                    style={inputStyle}
                  />
                </div>
              )}
            </fieldset>

            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>First claim</legend>

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
                <label style={labelStyle}>Claim text</label>
                <input
                  type="text"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  placeholder='e.g. "NOC Approved by CDA"'
                  required
                  style={inputStyle}
                />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Verification status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as 'VERIFIED' | 'PENDING')}
                  style={inputStyle}
                >
                  <option value="PENDING">PENDING</option>
                  <option value="VERIFIED">VERIFIED</option>
                </select>
              </div>

              <EvidenceEditor items={evidence} onChange={setEvidence} required={targetStatus === 'VERIFIED'} />
              {!evidenceOk && (
                <p style={{ fontSize: '12px', color: 'var(--error)' }}>
                  VERIFIED status requires at least one evidence item.
                </p>
              )}
            </fieldset>

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
              {submitting ? 'Creating…' : 'Create society'}
            </button>
          </form>
        )}
      </article>
    </main>
  );
}

export default function NewSocietyPage() {
  return (
    <Suspense fallback={null}>
      <NewSocietyForm />
    </Suspense>
  );
}

const fieldsetStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const legendStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--muted)',
  padding: '0 6px',
};
