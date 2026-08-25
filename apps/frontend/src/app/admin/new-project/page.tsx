'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ConstructionProjectStatus } from '@/lib/api';
import { createProject } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { fieldGroupStyle, inputStyle, labelStyle } from '../constants';

const STATUS_OPTIONS: ConstructionProjectStatus[] = ['ACTIVE', 'COMPLETE', 'ON_HOLD'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [propertyRef, setPropertyRef] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [status, setStatus] = useState<ConstructionProjectStatus>('ACTIVE');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && ownerContact.trim().length > 0 && startDate.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        property_ref: propertyRef.trim() || null,
        owner_contact: ownerContact.trim(),
        start_date: startDate,
        status,
      });
      // On success, straight to the project's management page — no
      // intermediate "created" screen, since the next thing an operator
      // does is start adding sections/expenses.
      router.push(`/admin/project/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
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
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Bahria 1180"'
              required
              style={inputStyle}
            />
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Property reference (optional)</label>
            <input
              type="text"
              value={propertyRef}
              onChange={(e) => setPropertyRef(e.target.value)}
              placeholder="Society/Property UUID, if this project has one"
              style={inputStyle}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Leave blank — most private renovations won&apos;t have one.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Owner contact</label>
              <input
                type="text"
                value={ownerContact}
                onChange={(e) => setOwnerContact(e.target.value)}
                placeholder="e.g. 0300-1234567"
                required
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ConstructionProjectStatus)} style={inputStyle}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
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
