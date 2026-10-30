'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/components/BackLink';
import { Spinner } from '@/components/Spinner';
import { fetchPublicProjects } from '@/lib/api';
import type { PublicProject, PublicProjectCategory, PublicProjectListResponse, PublicProjectStatus } from '@siraat/shared-types';
import { TRUST_GREEN, TRUST_GREEN_BG, TRUST_GREEN_BORDER, TRUST_GREEN_TEXT, WARNING_AMBER, RADIUS } from '@/styles/tokens';

const CATEGORIES: { key: '' | PublicProjectCategory; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'ROADS', label: 'Roads & motorways' },
  { key: 'TRANSIT', label: 'Rail & transit' },
  { key: 'NEW_CITY', label: 'New cities' },
  { key: 'HOUSING_PROGRAMME', label: 'Housing programmes' },
  { key: 'POLICY_TAX', label: 'Policy & tax' },
  { key: 'MASTER_PLAN', label: 'Master plans' },
];

const STATUS_LABEL: Record<PublicProjectStatus, string> = {
  PLANNED: 'Planned',
  ANNOUNCED: 'Announced',
  APPROVED: 'Approved',
  TENDERED: 'Tendering',
  UNDER_CONSTRUCTION: 'Under construction',
  DELAYED: 'Delayed',
  COMPLETED: 'Completed',
  ONGOING: 'Ongoing',
};

const fmtDate = (d: string | null) =>
  d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const chip = { fontSize: '12px', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--muted)' } as const;

function ProjectCard({ p }: { p: PublicProject }) {
  const done = p.status === 'COMPLETED';
  return (
    <li style={{ border: '1px solid var(--border)', borderRadius: RADIUS.md, padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fff' }}>
      <div>
        <strong style={{ fontSize: '16px', display: 'block' }}>{p.name}</strong>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{p.region}{p.province ? ` · ${p.province}` : ''}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: done ? TRUST_GREEN_BG : '#fff7ed', border: `1px solid ${done ? TRUST_GREEN_BORDER : WARNING_AMBER}`, color: done ? TRUST_GREEN_TEXT : '#92400e' }}>
          {STATUS_LABEL[p.status]}
        </span>
        {p.cost_pkr_bn !== null && <span style={chip}>Rs {p.cost_pkr_bn.toLocaleString()} bn</span>}
        {p.current_target && <span style={chip}>Target {fmtDate(p.current_target)}</span>}
        {p.delay_days > 0 && <span style={{ ...chip, color: '#92400e', borderColor: WARNING_AMBER }}>Moved {p.delay_days} days</span>}
        <span style={chip}>Not reviewed by Siraat</span>
      </div>
      <p style={{ fontSize: '14px', margin: 0, lineHeight: 1.5 }}>{p.summary}</p>
      {p.status_note && (
        <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
          <strong>Latest{p.status_date ? ` (${fmtDate(p.status_date)})` : ''}:</strong> {p.status_note}
        </p>
      )}
      {p.agencies && <p style={{ fontSize: '12px', margin: 0, color: 'var(--muted)' }}>Agencies: {p.agencies}</p>}
      {p.reports.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: 1.5 }}>
          {p.reports.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> <span style={{ color: 'var(--muted)' }}>({r.outlet}{r.published_at ? `, ${fmtDate(r.published_at)}` : ''})</span>
            </li>
          ))}
        </ul>
      )}
      {p.history.length > 1 && (
        <details style={{ fontSize: '12px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Status history ({p.history.length})</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px', lineHeight: 1.5 }}>
            {p.history.map((h) => (
              <li key={`${h.event_date}-${h.status}`}>
                {fmtDate(h.event_date)}: {STATUS_LABEL[h.status]}{h.target_date ? `, target ${fmtDate(h.target_date)}` : ''}{h.note ? `. ${h.note}` : ''}{' '}
                <a href={h.source_url} target="_blank" rel="noopener noreferrer">source</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', marginTop: 'auto' }}>
        Source ↗
      </a>
    </li>
  );
}

export default function ProjectsPage() {
  const [category, setCategory] = useState<'' | PublicProjectCategory>('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<PublicProjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const t = setTimeout(() => {
      fetchPublicProjects({ category: category || undefined, q: q.trim() || undefined })
        .then((r) => !cancelled && setData(r))
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load projects'));
    }, q ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [category, q]);

  return (
    <main style={{ width: '100%', maxWidth: '980px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <BackLink />
      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0 }}>Projects &amp; development</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.5 }}>
          Roads, rail, new cities, housing programmes and tax changes across Pakistan, with status, dates and sources.
          Headlines are picked up every day at 8 am from ARY, Geo and APP.
        </p>
      </div>

      <div role="note" style={{ border: `1px solid ${TRUST_GREEN_BORDER}`, background: TRUST_GREEN_BG, color: TRUST_GREEN_TEXT, borderRadius: RADIUS.md, padding: '12px 14px', fontSize: '13px', lineHeight: 1.5 }}>
        {data?.disclaimer ?? 'Information only, not advice to buy. Check each source yourself before you invest.'}
        {data?.last_refreshed_at && <> Last news check: {fmtDate(data.last_refreshed_at)}.</>}
        {data?.is_stale && <strong> The daily check has not run for more than {data.staleness_threshold_days} days, so headlines may be out of date.</strong>}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="group" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button
            key={c.key || 'all'}
            type="button"
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
            style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${category === c.key ? TRUST_GREEN : 'var(--border)'}`, background: category === c.key ? TRUST_GREEN_BG : '#fff', color: category === c.key ? TRUST_GREEN_TEXT : 'var(--text)' }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a project or place"
        aria-label="Search projects"
        style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: RADIUS.md, fontSize: '14px' }}
      />

      {error && <p role="alert" style={{ color: '#b91c1c', fontSize: '14px' }}>{error}</p>}
      {!data && !error && <Spinner />}
      {data && data.projects.length === 0 && <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No projects match. Try another category or search.</p>}
      {data && data.projects.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {data.projects.map((p) => <ProjectCard key={p.id} p={p} />)}
        </ul>
      )}

      {data && data.latest_reports.length > 0 && (
        <section aria-label="Latest development news" style={{ border: '1px solid var(--border)', borderRadius: RADIUS.md, padding: '14px 16px', background: '#fff' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px' }}>Latest development headlines</h2>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', lineHeight: 1.5 }}>
            {data.latest_reports.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>{' '}
                <span style={{ color: 'var(--muted)' }}>({r.outlet}{r.published_at ? `, ${fmtDate(r.published_at)}` : ''})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ fontSize: '13px' }}>
        Looking for affordable housing schemes approved by PHATA? <Link href="/new-projects" style={{ fontWeight: 700 }}>See the list</Link>.
      </p>
    </main>
  );
}
