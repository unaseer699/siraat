'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ConstructionProjectStatus } from '@/lib/api';
import { ApiError, createProject } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { errorTextStyle, fieldGroupStyle, inputStyle, labelStyle } from '../constants';

const STATUS_OPTIONS: ConstructionProjectStatus[] = ['ACTIVE', 'COMPLETE', 'ON_HOLD'];

// Same shape zod's .uuid() accepts server-side (any RFC 4122 variant, not just v4) —
// a client-side pre-check so an operator finds out about a bad property_ref
// immediately instead of via a server round-trip.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [propertyRef, setPropertyRef] = useState('');
  const [city, setCity] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [status, setStatus] = useState<ConstructionProjectStatus>('ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keyed by the backend's zod path (name / property_ref / owner_contact /
  // start_date / status) — matches ApiErrorDetail.path exactly, so a
  // server-side rejection can be dropped straight onto the field it's about.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const propertyRefTrimmed = propertyRef.trim();
  const propertyRefValid = propertyRefTrimmed.length === 0 || UUID_RE.test(propertyRefTrimmed);

  const canSubmit =
    name.trim().length > 0 &&
    ownerContact.trim().length > 0 &&
    startDate.trim().length > 0 &&
    propertyRefValid;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const project = await createProject({
        name: name.trim(),
        property_ref: propertyRef.trim() || null,
        city: city.trim() || null,
        owner_contact: ownerContact.trim(),
        start_date: startDate,
        status,
      });
      // On success, straight to the project's management page — no
      // intermediate "created" screen, since the next thing an operator
      // does is start adding sections/expenses.
      router.push(`/admin/project/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path, d.message])));
        // Field captions carry the specifics; the banner just says something
        // needs fixing rather than repeating "Validation failed" verbatim.
        setError('Fix the highlighted field(s) below.');
      } else {
        setError(err instanceof Error ? err.message : 'Submission failed');
      }
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 32px',
        gap: '28px',
      }}
    >
      <div style={{ maxWidth: '560px', width: '100%' }}>
        <AdminNav active="projects" />
      </div>

      <article style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>New Project</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            An organized expense ledger for one construction project — e.g. &ldquo;Bahria
            1180&rdquo;. Add sections and expenses next.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: '' }));
              }}
              placeholder='e.g. "Bahria 1180"'
              required
              style={fieldErrors.name ? { ...inputStyle, borderColor: 'var(--error)' } : inputStyle}
            />
            {fieldErrors.name && <p style={errorTextStyle}>{fieldErrors.name}</p>}
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Property reference (optional)</label>
            <input
              type="text"
              value={propertyRef}
              onChange={(e) => {
                setPropertyRef(e.target.value);
                if (fieldErrors.property_ref) setFieldErrors((f) => ({ ...f, property_ref: '' }));
              }}
              placeholder="Full UUID only — leave blank if unknown"
              style={
                fieldErrors.property_ref || !propertyRefValid
                  ? { ...inputStyle, borderColor: 'var(--error)' }
                  : inputStyle
              }
            />
            {fieldErrors.property_ref ? (
              <p style={errorTextStyle}>{fieldErrors.property_ref}</p>
            ) : !propertyRefValid ? (
              <p style={errorTextStyle}>
                Must be a full UUID, e.g. 8f14e45f-ceea-4b3e-9c2a-1a2b3c4d5e6f.
              </p>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Leave blank — most private renovations won&apos;t have one.
              </p>
            )}
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>City (optional)</label>
            <input
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                if (fieldErrors.city) setFieldErrors((f) => ({ ...f, city: '' }));
              }}
              placeholder="e.g. Islamabad"
              style={fieldErrors.city ? { ...inputStyle, borderColor: 'var(--error)' } : inputStyle}
            />
            {fieldErrors.city ? (
              <p style={errorTextStyle}>{fieldErrors.city}</p>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Powers material price observations for this project even without a linked property.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Owner contact</label>
              <input
                type="text"
                value={ownerContact}
                onChange={(e) => {
                  setOwnerContact(e.target.value);
                  if (fieldErrors.owner_contact) setFieldErrors((f) => ({ ...f, owner_contact: '' }));
                }}
                placeholder="e.g. 0300-1234567"
                required
                style={fieldErrors.owner_contact ? { ...inputStyle, borderColor: 'var(--error)' } : inputStyle}
              />
              {fieldErrors.owner_contact && <p style={errorTextStyle}>{fieldErrors.owner_contact}</p>}
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (fieldErrors.start_date) setFieldErrors((f) => ({ ...f, start_date: '' }));
                }}
                required
                style={fieldErrors.start_date ? { ...inputStyle, borderColor: 'var(--error)' } : inputStyle}
              />
              {fieldErrors.start_date && <p style={errorTextStyle}>{fieldErrors.start_date}</p>}
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ConstructionProjectStatus);
                if (fieldErrors.status) setFieldErrors((f) => ({ ...f, status: '' }));
              }}
              style={fieldErrors.status ? { ...inputStyle, borderColor: 'var(--error)' } : inputStyle}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            {fieldErrors.status && <p style={errorTextStyle}>{fieldErrors.status}</p>}
          </div>

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
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </form>
      </article>
    </main>
  );
}
