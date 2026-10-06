'use client';

import { useEffect, useState } from 'react';
import { fetchOwnerProjectDocuments, type ProjectDocument } from '@/lib/api';

const KIND_LABEL: Record<string, string> = {
  ARCHITECTURAL: 'Architectural drawings',
  STRUCTURAL: 'Structural drawings',
  ELECTRICAL: 'Electrical drawings',
  PLUMBING: 'Plumbing drawings',
  SOIL: 'Soil report',
  OTHER: 'Document',
};

// Drawings and reports the project's admin has chosen to share with the owner.
export default function ProjectDocumentsCard({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<ProjectDocument[]>([]);

  useEffect(() => {
    fetchOwnerProjectDocuments(projectId).then(setDocs).catch(() => setDocs([]));
  }, [projectId]);

  if (docs.length === 0) return null;
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', background: '#fff', width: '100%' }}>
      <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Drawings &amp; reports</h2>
      {docs.map((d) => (
        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: '14px' }}>
          <span>
            {d.title}
            <span style={{ color: 'var(--muted)' }}> · {KIND_LABEL[d.kind] ?? 'Document'}</span>
          </span>
          {d.download_url && (
            <a href={d.download_url} target="_blank" rel="noreferrer">View</a>
          )}
        </div>
      ))}
    </section>
  );
}
