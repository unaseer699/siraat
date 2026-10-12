'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SocietyBrowseSummary, SocietyListResponse } from '@siraat/shared-types';
import { fetchSocieties, fetchPlatformStats } from '@/lib/api';
import { Spinner } from '@/components/Spinner';
import { paginationButtonStyle } from '@/styles/pagination';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY, REVOKED_SLATE } from '@/styles/tokens';

const MAX = 3;
const PAGE_SIZE = 24;

const STATUS: Record<string, { color: string; label: string }> = {
  VERIFIED: { color: TRUST_GREEN, label: '✓ Verified' },
  DISPUTED: { color: DANGER_RED, label: '⚠ Disputed' },
  CANCELLED: { color: REVOKED_SLATE, label: '✕ Cancelled' },
  PARTIAL: { color: WARNING_AMBER, label: 'Partial' },
  PENDING: { color: NEUTRAL_GRAY, label: 'Pending' },
};

interface Picked {
  id: string;
  name: string;
}

// Pick 2-3 societies from the full list, then open the side-by-side view.
// Search + city filter + paging keep it usable with hundreds of societies, and
// the picks stay in the bottom tray while you search or change page.
export function ComparePicker({ initial = [] }: { initial?: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SocietyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Picked[]>(initial.slice(0, MAX).map((id) => ({ id, name: '' })));
  const [error, setError] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPlatformStats().then((s) => setCities(s.cities_covered)).catch(() => {});
  }, []);

  // New search or city starts again from page 1.
  useEffect(() => setPage(1), [q, city]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetchSocieties({ q: q.trim() || undefined, city: city || undefined, page, limit: PAGE_SIZE })
        .then((r) => {
          if (cancelled) return;
          setData(r);
          setError(null);
          // Fill in names for pre-selected ids once they appear in a list.
          setPicked((p) => p.map((x) => ({ ...x, name: x.name || r.societies.find((s) => s.id === x.id)?.name || 'Selected society' })));
        })
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load societies'))
        .finally(() => !cancelled && setLoading(false));
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, city, page]);

  function changePage(n: number) {
    setPage(n);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const isPicked = (id: string) => picked.some((p) => p.id === id);
  function toggle(s: SocietyBrowseSummary) {
    setPicked((p) => (p.some((x) => x.id === s.id) ? p.filter((x) => x.id !== s.id) : p.length >= MAX ? p : [...p, { id: s.id, name: s.name }]));
  }
  const ready = picked.length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px', paddingBottom: '110px' }}>
      <div ref={top} style={{ scrollMarginTop: '12px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Compare societies</h1>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
          Choose 2 or 3 societies. Search by name or pick a city to narrow the list.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by society name…"
          aria-label="Search societies"
          style={{ flex: '1 1 240px', minWidth: 0, padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', background: '#fff' }}
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="City"
          style={{ padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', background: '#fff' }}
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {data && (
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
          {data.total_count} societ{data.total_count === 1 ? 'y' : 'ies'}
          {q || city ? ' found' : ''}
        </p>
      )}

      {error && <p style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</p>}
      {!data && !error && <Spinner label="Loading societies…" />}
      {data && data.societies.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No societies match your search.</p>}

      {data && data.societies.length > 0 && (
        <div style={{ position: 'relative' }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '10px',
              opacity: loading ? 0.5 : 1,
              transition: 'opacity .15s',
            }}
          >
            {data.societies.map((s) => {
              const on = isPicked(s.id);
              const capped = !on && picked.length >= MAX;
              const st = STATUS[s.verification_status] ?? STATUS.PENDING;
              return (
                <li key={s.id}>
                  <label
                    title={capped ? 'You can compare up to 3 societies' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      height: '100%',
                      padding: '12px 14px',
                      background: on ? '#f3f4f6' : '#fff',
                      border: `1.5px solid ${on ? '#111' : 'var(--border)'}`,
                      borderLeft: `4px solid ${st.color}`,
                      borderRadius: 'var(--radius)',
                      cursor: capped ? 'not-allowed' : 'pointer',
                      opacity: capped ? 0.5 : 1,
                    }}
                  >
                    <input type="checkbox" checked={on} disabled={capped} onChange={() => toggle(s)} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, lineHeight: 1.3 }}>{s.name}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {s.city} · <span style={{ color: st.color, fontWeight: 700 }}>{st.label}</span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          {data.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
              <button onClick={() => changePage(page - 1)} disabled={page <= 1} style={paginationButtonStyle(page <= 1)}>← Prev</button>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Page {data.page} of {data.total_pages}</span>
              <button onClick={() => changePage(page + 1)} disabled={page >= data.total_pages} style={paginationButtonStyle(page >= data.total_pages)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Selection tray: always visible, so picks survive search and paging */}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          width: 'min(640px, calc(100vw - 24px))',
          background: '#111',
          color: '#fff',
          borderRadius: '16px',
          padding: '10px 12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 200px', display: 'flex', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
          {picked.length === 0 && <span style={{ fontSize: '13px', opacity: 0.8 }}>Tick 2 or 3 societies to compare</span>}
          {picked.map((p) => (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#374151', borderRadius: '99px', padding: '4px 6px 4px 12px', fontSize: '13px', fontWeight: 600, maxWidth: '100%' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || 'Selected society'}</span>
              <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
            </span>
          ))}
          {picked.length === 1 && <span style={{ fontSize: '12px', opacity: 0.8, alignSelf: 'center' }}>pick 1 more</span>}
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={() => router.push(`/compare?ids=${encodeURIComponent(picked.map((p) => p.id).join(','))}`)}
          style={{ fontSize: '14px', fontWeight: 700, color: '#111', background: ready ? '#fff' : '#9ca3af', border: 'none', borderRadius: '999px', padding: '10px 18px', cursor: ready ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
        >
          Compare {picked.length > 0 ? `(${picked.length}) ` : ''}→
        </button>
      </div>
    </div>
  );
}
