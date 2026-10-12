'use client';

import { useState } from 'react';
import Link from 'next/link';
import { deleteProject, removeProjectPhoto, setProjectStatus, type ContractorProject } from '@/lib/api';
import { plainButtonStyle, dangerButtonStyle, primaryButtonStyle } from '@/app/admin/buttonStyles';

const STATUS: Record<ContractorProject['status'], { label: string; color: string }> = {
  PUBLISHED: { label: 'Published', color: '#166534' },
  PENDING_REVIEW: { label: 'Waiting for review', color: '#b45309' },
  REJECTED: { label: 'Rejected', color: '#475569' },
};

// One portfolio project in the admin: photos, details, and review actions.
export function AdminProjectCard({ project, onChanged, showContractor = false }: { project: ContractorProject; onChanged: () => void; showContractor?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = STATUS[project.status];

  async function run(fn: () => Promise<unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^API error \d+: /, '') : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const meta = [project.society_name, project.city, project.plot_size, project.completed_year].filter(Boolean).join(' · ');

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          {showContractor && (
            <Link href={`/admin/contractor/${project.contractor_id}/portfolio`} style={{ fontSize: '12px', fontWeight: 700 }}>
              {project.contractor_name} →
            </Link>
          )}
          <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '2px 0 0' }}>{project.title}</h3>
          {meta && <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '2px 0 0' }}>{meta}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: st.color }}>{st.label}</span>
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 0' }}>{project.source === 'CONTRACTOR' ? 'Sent by contractor (unverified)' : 'Added by admin'}</p>
        </div>
      </div>
      {project.description && <p style={{ fontSize: '13px', margin: 0 }}>{project.description}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
        {project.photos.map((ph) => (
          <div key={ph.key ?? ph.url} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <a href={ph.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </a>
            {ph.key && (
              <button type="button" aria-label="Remove photo" disabled={busy} onClick={() => run(() => removeProjectPhoto(project.id, ph.key as string), 'Remove this photo?')} style={{ position: 'absolute', top: '4px', right: '4px', width: '24px', height: '24px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>
        ))}
        {project.photos.length === 0 && <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>No photos.</p>}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {project.status !== 'PUBLISHED' && (
          <button type="button" disabled={busy} onClick={() => run(() => setProjectStatus(project.id, 'PUBLISHED'))} style={primaryButtonStyle(busy)}>
            Publish
          </button>
        )}
        {project.status === 'PUBLISHED' && (
          <button type="button" disabled={busy} onClick={() => run(() => setProjectStatus(project.id, 'REJECTED'), 'Hide this project from the public page?')} style={plainButtonStyle}>
            Unpublish
          </button>
        )}
        {project.status === 'PENDING_REVIEW' && (
          <button type="button" disabled={busy} onClick={() => run(() => setProjectStatus(project.id, 'REJECTED'))} style={plainButtonStyle}>
            Reject
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => run(() => deleteProject(project.id), 'Delete this project and its photos permanently?')} style={dangerButtonStyle(busy)}>
          Delete
        </button>
      </div>
      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--error)' }}>{error}</p>}
    </div>
  );
}
