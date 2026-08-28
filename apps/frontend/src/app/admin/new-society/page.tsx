'use client';

import { Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  createSociety,
  searchDevelopers,
  searchSocieties,
  type AdminEvidenceItem,
  type ClaimType,
  type DeveloperSearchResult,
  type SocietySearchResult,
} from '@/lib/api';
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

// DEVELOPER-SOCIETY LINK Chunk 3 — search-as-you-type over GET /admin/developers.
// The operator only ever sees developer names; the selected UUID is tracked
// internally (developerId) and never rendered back into the input.
function DeveloperSearchField({
  query,
  onQueryChange,
  developerId,
  onSelect,
  onClear,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  developerId: string | null;
  onSelect: (result: DeveloperSearchResult) => void;
  onClear: () => void;
}) {
  const [results, setResults] = useState<DeveloperSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || developerId) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchDevelopers(trimmed);
        if (id === requestId.current) setResults(found);
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, developerId]);

  const showDropdown = !developerId && query.trim().length > 0 && (searching || results.length > 0);

  return (
    <div style={{ ...fieldGroupStyle, position: 'relative' }}>
      <label style={labelStyle}>Developer (optional)</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Start typing a developer name…"
          autoComplete="off"
          style={{ ...inputStyle, flex: 1 }}
        />
        {developerId && (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: '0 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: '#fff',
              fontSize: '13px',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {developerId ? (
        <p style={{ fontSize: '12px', color: '#166534' }}>✓ Linked — this society will show under this developer&apos;s profile.</p>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Leave blank if the developer is unknown. Select a match to link it.
        </p>
      )}

      {showDropdown && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            margin: 0,
            marginTop: '4px',
            padding: '4px',
            listStyle: 'none',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {searching && (
            <li style={{ padding: '8px 10px', fontSize: '13px', color: 'var(--muted)' }}>Searching…</li>
          )}
          {!searching && results.length === 0 && (
            <li style={{ padding: '8px 10px', fontSize: '13px', color: 'var(--muted)' }}>No matching developers</li>
          )}
          {!searching &&
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {r.name}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
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
  const [developerQuery, setDeveloperQuery] = useState('');
  const [developerId, setDeveloperId] = useState<string | null>(null);
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

  // DUPLICATE SOCIETY PREVENTION — live name+city check as the operator
  // types, same debounce/stale-response-guard pattern as DeveloperSearchField
  // above (300ms + a request-id ref), catching the mistake before the
  // wasted round-trip a submit-then-fail would cost. Fires once BOTH fields
  // have something in them — an incomplete pair can't be a real duplicate,
  // same guard PropertyIntelligenceService.findSocietyByNameAndCity uses.
  const [duplicateMatch, setDuplicateMatch] = useState<SocietySearchResult | null>(null);
  const duplicateRequestId = useRef(0);

  useEffect(() => {
    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    if (!trimmedName || !trimmedCity) {
      setDuplicateMatch(null);
      return;
    }
    const id = ++duplicateRequestId.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchSocieties(trimmedName, trimmedCity);
        if (id === duplicateRequestId.current) setDuplicateMatch(found[0] ?? null);
      } catch {
        // A failed check shouldn't block the operator — the server's own
        // hard block on submit is still the real enforcement point.
        if (id === duplicateRequestId.current) setDuplicateMatch(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name, city]);

  function toggleType(t: string) {
    setPropertyTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const confidenceNum = Number(baseConfidence);
  const confidenceValid = Number.isFinite(confidenceNum) && confidenceNum >= 0 && confidenceNum <= 1;
  const evidenceOk = targetStatus !== 'VERIFIED' || evidence.length > 0;
  const affiliationOk = !isAffiliated || affiliationDisclosure.trim().length > 0;
  const canSubmit =
    name.trim() && city.trim() && claim.trim() && confidenceValid && evidenceOk && affiliationOk && !duplicateMatch;

  function handleDeveloperSelect(r: DeveloperSearchResult) {
    setDeveloperId(r.id);
    setDeveloperQuery(r.name);
  }

  function handleDeveloperQueryChange(v: string) {
    setDeveloperQuery(v);
    // Any edit invalidates a prior selection — must re-select to link again.
    setDeveloperId(null);
  }

  function handleDeveloperClear() {
    setDeveloperId(null);
    setDeveloperQuery('');
  }

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
        developer_id: developerId,
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

              {duplicateMatch && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#fffbeb',
                    border: '1px solid #f59e0b',
                    borderRadius: 'var(--radius)',
                    color: '#92400e',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span>
                    ⚠ A society named &ldquo;{duplicateMatch.name}&rdquo; already exists in {duplicateMatch.city}.
                  </span>
                  <Link href={`/admin/society/${duplicateMatch.id}/add-claim`} style={{ fontWeight: 600, color: '#92400e' }}>
                    Add a claim to it instead →
                  </Link>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Min price (PKR)</label>
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Max price (PKR)</label>
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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

              <DeveloperSearchField
                query={developerQuery}
                onQueryChange={handleDeveloperQueryChange}
                developerId={developerId}
                onSelect={handleDeveloperSelect}
                onClear={handleDeveloperClear}
              />

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
