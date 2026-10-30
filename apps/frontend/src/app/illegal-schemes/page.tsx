'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/Spinner';
import { BackLink } from '@/components/BackLink';
import { SchemeTabs } from '@/components/SchemeTabs';
import { paginationButtonStyle } from '@/styles/pagination';
import { fetchUnapprovedSchemes } from '@/lib/api';
import { DANGER_RED, RADIUS } from '@/styles/tokens';
import type { UnapprovedSchemeListResponse } from '@siraat/shared-types';
import { OTHER_AUTHORITIES } from '../../lib/otherAuthorities';

const PAGE_SIZE = 30;
const RED_BG = '#fef2f2';
const RED_BORDER = '#fecaca';
const AREAS_BY_REGULATOR: Record<string, string[]> = {
  CDA: ['Simly Dam Road', 'Lehtrar Road', 'Kuri Road', 'Park Road', 'Chakri Road', 'Adyala Road', 'Murree', 'Taxila', 'Bani Gala', 'Nilore'],
  RDA: ['Chakri Road', 'Adyala Road', 'Kallar Syedan Road', 'Gujar Khan', 'Taxila', 'Murree Road'],
  FDA: ['Azafi Abadi', 'Chak No.', 'Satyana Road', 'Sargodha Road', 'Samundari Road', 'Millat Road'],
  PDA: ['Nasir Bagh Road', 'Warsak Road', 'G.T. Road', 'Ring Road', 'Charsadda Road'],
  LDA: ['Raiwind Road', 'Ferozepur Road', 'Barki Road', 'BRB Canal Road', 'Multan Road', 'G.T Road', 'Bedian Road', 'Canal Road'],
};
const ALL_AREAS = ['Simly Dam Road', 'Chakri Road', 'Adyala Road', 'Raiwind Road', 'Ferozepur Road', 'Barki Road', 'Multan Road', 'Murree'];
const REGULATORS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'CDA', label: 'CDA (Islamabad)' },
  { key: 'RDA', label: 'RDA (Rawalpindi)' },
  { key: 'LDA', label: 'LDA (Lahore)' },
  { key: 'PDA', label: 'PDA (Peshawar)' },
  { key: 'FDA', label: 'FDA (Faisalabad)' },
];

function formatDate(iso: string | null): string {
  if (!iso) return 'unknown date';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function IllegalSchemesPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [regulator, setRegulator] = useState('');
  const [data, setData] = useState<UnapprovedSchemeListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchUnapprovedSchemes({ q: q || undefined, regulator: regulator || undefined, page, limit: PAGE_SIZE })
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the list'));
    return () => {
      cancelled = true;
    };
  }, [q, regulator, page]);

  return (
    <main style={{ width: '100%', maxWidth: '980px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <BackLink />
      <SchemeTabs active="unapproved" />

      <div>
        <p style={{ fontSize: '12px', color: DANGER_RED, fontWeight: 700, marginBottom: '4px' }}>LISTED AS UNAPPROVED</p>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Schemes without regulator approval</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
          {data ? `${data.total_count} scheme${data.total_count === 1 ? '' : 's'}${q ? ' found' : ' listed'}` : 'Loading…'}
        </p>
      </div>

      <div
        role="note"
        style={{ background: RED_BG, border: `1px solid ${RED_BORDER}`, borderLeft: `4px solid ${DANGER_RED}`, borderRadius: RADIUS.md, padding: '12px 14px', fontSize: '13px', lineHeight: 1.5 }}
      >
        <strong>Read this first.</strong> {data?.disclaimer ?? 'This is the regulator\'s own published list. Confirm with the regulator before buying.'}
        {data && data.sources.length > 0 && (
          <>
            {' '}Lists read from{' '}
            {data.sources.map((src, idx) => (
              <span key={src.regulator}>
                {idx > 0 && ' and '}
                <a href={src.source_url} target="_blank" rel="noopener noreferrer" style={{ color: DANGER_RED, fontWeight: 700 }}>
                  {src.regulator}
                </a>{' '}
                on {formatDate(src.listed_as_of)}
              </span>
            ))}
            .
          </>
        )}
        {data?.is_stale && (
          <p style={{ margin: '6px 0 0', fontWeight: 700 }}>
            This copy is more than {data.staleness_threshold_days} days old and may have changed.
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="group" aria-label="Regulator">
        {REGULATORS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              setRegulator(r.key);
              setPage(1);
            }}
            style={{
              fontSize: '13px',
              fontWeight: 700,
              padding: '6px 14px',
              borderRadius: '99px',
              cursor: 'pointer',
              border: `1px solid ${regulator === r.key ? DANGER_RED : 'var(--border)'}`,
              background: regulator === r.key ? DANGER_RED : '#fff',
              color: regulator === r.key ? '#fff' : 'var(--text)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by scheme name or area…"
        aria-label="Search schemes the regulators list as unapproved"
        style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: RADIUS.md, fontSize: '15px' }}
      />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(AREAS_BY_REGULATOR[regulator] ?? ALL_AREAS).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setSearch(search === a ? '' : a)}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '99px',
              cursor: 'pointer',
              border: `1px solid ${search === a ? DANGER_RED : 'var(--border)'}`,
              background: search === a ? RED_BG : '#fff',
              color: search === a ? DANGER_RED : 'var(--text)',
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {error && <p style={{ color: DANGER_RED }}>{error}</p>}
      {!data && !error && <Spinner />}

      {data && data.state === 'NOT_COVERED' && (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          No scheme on the {regulator || 'CDA, RDA, LDA, PDA or FDA'} list matches &ldquo;{q}&rdquo;. That does not mean it is approved — check the approved
          list or ask the regulator.
        </p>
      )}

      {data && data.schemes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {data.schemes.map((s) => (
            <article
              key={s.id}
              style={{ background: RED_BG, border: `1px solid ${RED_BORDER}`, borderLeft: `4px solid ${DANGER_RED}`, borderRadius: RADIUS.md, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>{s.name}</h2>
              {s.location && <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>{s.location}</p>}
              {s.note && <p style={{ fontSize: '12px', margin: 0 }}>{s.regulator} note: {s.note}</p>}
              <p style={{ fontSize: '12px', color: DANGER_RED, fontWeight: 700, margin: '4px 0 0' }}>
                Listed by {s.regulator} as unapproved
              </p>
            </article>
          ))}
        </div>
      )}

      {data && data.total_pages > 1 && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} style={paginationButtonStyle(page <= 1)}>
            ← Previous
          </button>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Page {page} of {data.total_pages}
          </span>
          <button type="button" disabled={page >= data.total_pages} onClick={() => setPage(page + 1)} style={paginationButtonStyle(page >= data.total_pages)}>
            Next →
          </button>
        </div>
      )}

      <section
        aria-label="Other authorities"
        style={{ border: '1px solid var(--border)', borderRadius: RADIUS.md, padding: '14px 16px', fontSize: '13px', lineHeight: 1.5, background: '#fff' }}
      >
        <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>Other cities: ask the authority</h2>
        <p style={{ margin: '0 0 8px', color: 'var(--muted)' }}>
          We do not hold these authorities&apos; approved or unapproved lists yet, so a scheme missing here says nothing about its status. Ask the
          authority for the NOC before you pay.
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {OTHER_AUTHORITIES.map((a) => (
            <li key={a.short}>
              <strong>{a.short}</strong> · {a.name} ({a.area}){' '}
              {a.url ? (
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  Official site
                </a>
              ) : (
                <span style={{ color: 'var(--muted)' }}>(official site to be added)</span>
              )}
              {a.note && <span style={{ color: 'var(--muted)' }}> {a.note}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
