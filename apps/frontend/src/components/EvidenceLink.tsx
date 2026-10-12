'use client';

import { useState } from 'react';
import { fetchEvidenceDownloadUrl } from '@/lib/api';

// "View PDF" link for one evidence item. Official CDA/RDA links open straight
// on the portal; stored files get a short-lived signed link.
export function EvidenceLink({ id, label = 'View PDF' }: { id: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function open() {
    setBusy(true);
    setErr(false);
    try {
      const { url } = await fetchEvidenceDownloadUrl(id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: busy ? 'var(--muted)' : '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
      >
        {busy ? 'Opening…' : label}
      </button>
      {err && <span style={{ color: 'var(--error)', fontSize: '12px', marginLeft: '6px' }}>Could not open. Try again.</span>}
    </>
  );
}
