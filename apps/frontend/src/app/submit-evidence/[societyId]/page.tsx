'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { requestEvidenceUploadUrl, uploadFileToPresignedUrl, submitEvidence } from '@/lib/api';

// Mirrors Vercel's serverless body cap elsewhere in the app (house-plan
// image uploads) — not strictly needed here since this always goes through
// the presigned-PUT path, never through this app's own server, but a
// sensible ceiling on what a contributor should be uploading as evidence.
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

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
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (picked && picked.size > MAX_FILE_BYTES) {
      setError(`File is too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB).`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(picked);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceRef.trim() || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const { upload_url, key } = await requestEvidenceUploadUrl(societyId, {
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
      });
      await uploadFileToPresignedUrl(upload_url, file);
      await submitEvidence(societyId, { type, source_ref: sourceRef, file_ref: key });
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
            <label style={{ fontSize: '13px', fontWeight: 600 }}>File</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              required
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                background: '#fff',
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Photo or PDF, up to {MAX_FILE_BYTES / (1024 * 1024)}MB.
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
            disabled={submitting || !sourceRef.trim() || !file}
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
            {submitting ? 'Uploading…' : 'Submit for review'}
          </button>
        </form>
      </article>
    </main>
  );
}
