'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { submitEvidence } from '@/lib/api';

const EVIDENCE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'photo', label: 'Photo' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'inspection_report', label: 'Inspection Report' },
] as const;

type EvidenceType = 'document' | 'photo' | 'receipt' | 'inspection_report';

export default function SubmitEvidencePage() {
  const params = useParams();
  const router = useRouter();
  const societyId = params.societyId as string;

  const [type, setType] = useState<EvidenceType>('photo');
  const [sourceRef, setSourceRef] = useState('');
  const [fileRef, setFileRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceRef.trim() || !fileRef.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitEvidence(societyId, { type, source_ref: sourceRef, file_ref: fileRef });
      // Submission is only pending review, not published yet — send the
      // contributor back to the society profile rather than a dead-end
      // confirmation screen with nowhere left to go.
      router.push(`/society/${societyId}`);
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
        padding: '48px 16px 32px',
      }}
    >
      <article style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <Link href={`/society/${societyId}`} style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to society profile
        </Link>

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            CONTRIBUTE
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Submit Evidence</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Help verify this society by submitting supporting documents or photos. All submissions are reviewed before publication.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Evidence type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EvidenceType)}
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                background: '#fff',
              }}
            >
              {EVIDENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>
              Source description
            </label>
            <input
              type="text"
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              placeholder="e.g. Photo taken at site, Aug 2026"
              required
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>
              File reference
            </label>
            <input
              type="text"
              value={fileRef}
              onChange={(e) => setFileRef(e.target.value)}
              placeholder="e.g. uploads/myfile.pdf"
              required
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              File upload pipeline coming soon — enter the file path or name for now.
            </p>
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
            disabled={submitting || !sourceRef.trim() || !fileRef.trim()}
            style={{
              padding: '12px 20px',
              background: submitting ? 'var(--muted)' : '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      </article>
    </main>
  );
}
