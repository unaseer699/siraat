'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SocietyBrowseSummary } from '@siraat/shared-types';
import { fetchSocieties } from '@/lib/api';
import { Spinner } from '@/components/Spinner';

const MAX = 3;

// Pick 2-3 societies from the full list, then open the side-by-side view.
export function ComparePicker({ initial = [] }: { initial?: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [list, setList] = useState<SocietyBrowseSummary[] | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string }[]>(initial.map((id) => ({ id, name: '' })));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetchSocieties({ q: q.trim() || undefined, page: 1, limit: 50 })
        .then((r) => {
          if (cancelled) return;
          setList(r.societies);
          setError(null);
          // Fill in names for pre-selected ids once we see them in a list.
          setPicked((p) => p.map((x) => ({ ...x, name: x.name || r.societies.find((s) => s.id === x.id)?.name || '' })));
        })
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load societies'));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const isPicked = (id: string) => picked.some((p) => p.id === id);
  function toggle(s: SocietyBrowseSummary) {
    setPicked((p) => (p.some((x) => x.id === s.id) ? p.filter((x) => x.id !== s.id) : p.length >= MAX ? p : [...p, { id: s.id, name: s.name }]));
  }
  const ready = picked.length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Compare societies</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>Tick 2 or 3 societies, then press Compare.</p>
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by society name…"
        aria-label="Search societies"
        style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', background: '#fff' }}
      />

      {error && <p style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</p>}
      {!list && !error && <Spinner label="Loading societies…" />}
      {list && list.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No societies match “{q}”.</p>}

      {list && list.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '80px' }}>
          {list.map((s) => {
            const on = isPicked(s.id);
            const capped = !on && picked.length >= MAX;
            return (
              <li key={s.id}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: on ? '#f3f4f6' : '#fff',
                    border: `1.5px solid ${on ? '#111' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    cursor: capped ? 'not-allowed' : 'pointer',
                    opacity: capped ? 0.55 : 1,
                  }}
                >
                  <input type="checkbox" checked={on} disabled={capped} onChange={() => toggle(s)} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 700 }}>{s.name}</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{s.city}</span>
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{s.verification_status === 'VERIFIED' ? '✓ Verified' : s.verification_status[0] + s.verification_status.slice(1).toLowerCase()}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: '10px', background: '#111', color: '#fff', borderRadius: '999px', padding: '8px 10px 8px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', maxWidth: 'calc(100vw - 24px)' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {picked.length} of {MAX} selected{picked.length === 1 ? ' · pick 1 more' : picked.length === 0 ? ' · pick 2' : ''}
        </span>
        <button
          type="button"
          disabled={!ready}
          onClick={() => router.push(`/compare?ids=${encodeURIComponent(picked.map((p) => p.id).join(','))}`)}
          style={{ fontSize: '14px', fontWeight: 700, color: '#111', background: ready ? '#fff' : '#9ca3af', border: 'none', borderRadius: '999px', padding: '8px 16px', cursor: ready ? 'pointer' : 'not-allowed' }}
        >
          Compare →
        </button>
      </div>
    </div>
  );
}
