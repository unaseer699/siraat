'use client';

import { useState } from 'react';
import { fetchRecommendationExport } from '@/lib/api';

interface Props {
  recommendationId: string;
}

export function DownloadReportButton({ recommendationId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const { blob, filename } = await fetchRecommendationExport(recommendationId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download report. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: loading ? 'var(--muted)' : 'var(--text)',
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '6px 12px',
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Preparing…' : 'Download Report'}
      </button>
      {error && (
        <p style={{ fontSize: '11px', color: 'var(--error)', margin: 0 }}>{error}</p>
      )}
    </div>
  );
}
