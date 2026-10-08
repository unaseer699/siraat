'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicBuild, PublicBuildsResponse } from '@siraat/shared-types';
import { BackLink } from '@/components/BackLink';
import { Spinner } from '@/components/Spinner';
import { fetchPublicBuilds } from '@/lib/api';
import { ACCENT_BLUE, TRUST_GREEN, WARNING_AMBER } from '@/styles/tokens';

const CSS = `
.rb-grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:900px){.rb-grid{grid-template-columns:1fr 1fr}}
.rb-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
`;

function pkr(n: number): string {
  if (n >= 10_000_000) return `PKR ${(n / 10_000_000).toFixed(2)} Cr`;
  return `PKR ${(n / 100_000).toFixed(1)} Lac`;
}

function monthLabel(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const STATUS_TEXT: Record<PublicBuild['status'], string> = { ACTIVE: 'In progress', COMPLETE: 'Completed', ON_HOLD: 'On hold' };

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color }} />
    </div>
  );
}

function BuildCard({ b }: { b: PublicBuild }) {
  const over = b.variance_pct !== null && b.variance_pct > 0;
  const varianceColor = b.variance_pct === null ? 'var(--muted)' : over ? WARNING_AMBER : TRUST_GREEN;
  const spentShare = b.estimated_total > 0 ? (b.spent_total / b.estimated_total) * 100 : 0;
  return (
    <article style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div>
        <h2 style={{ fontSize: '19px', fontWeight: 800, lineHeight: 1.25 }}>{b.title}</h2>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
          {STATUS_TEXT[b.status]} · started {monthLabel(b.started_month)} · {b.covered_area_sqft.toLocaleString('en-US')} sq ft covered ·{' '}
          {b.floors} {b.floors === 1 ? 'floor' : 'floors'} · {b.finish_level.toLowerCase()} finish
        </p>
      </div>

      {b.overall_progress_pct !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
            <span>Overall progress</span>
            <span>{b.overall_progress_pct}%</span>
          </div>
          <Bar pct={b.overall_progress_pct} color={ACCENT_BLUE} />
        </div>
      )}

      <div className="rb-stats">
        <Stat label="Estimate" value={pkr(b.estimated_total)} />
        <Stat label="Spent so far" value={pkr(b.spent_total)} sub={`${Math.round(spentShare)}% of estimate`} />
        <Stat label="Projected final" value={pkr(b.forecast_total)} sub={b.variance_pct === null ? undefined : `${over ? '+' : ''}${b.variance_pct}% vs estimate`} subColor={varianceColor} />
      </div>
      {b.per_sqft !== null && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Projected cost per sq ft: <strong style={{ color: 'var(--text)' }}>PKR {b.per_sqft.toLocaleString('en-US')}</strong></p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--muted)' }}>PHASES</div>
        {b.phases.map((p) => (
          <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '14px' }}>
              <strong>{p.label}</strong>
              <span style={{ color: 'var(--muted)' }}>
                {pkr(p.spent)}
                {p.estimated !== null ? ` of ${pkr(p.estimated)}` : ''}
                {p.progress_pct !== null ? ` · ${p.progress_pct}% done` : ''}
              </span>
            </div>
            <Bar pct={p.progress_pct ?? 0} color={TRUST_GREEN} />
          </div>
        ))}
      </div>
    </article>
  );
}

function Stat({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '2px' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', fontWeight: 600, color: subColor ?? 'var(--muted)', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

export default function RealBuildsPage() {
  const [data, setData] = useState<PublicBuildsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPublicBuilds().then(setData).catch(() => setError(true));
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px' }}>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>REAL BUILDS</p>
          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2 }}>Homes being built right now</h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', marginTop: '6px' }}>
            Real projects, shared by their owners: how far each phase has come and what it has cost against the estimate.
            Names, locations and contact details are never shown.
          </p>
        </div>

        {error && <p style={{ color: 'var(--error)', fontSize: '14px' }}>Could not load builds right now. Please try again shortly.</p>}
        {!data && !error && <Spinner label="Loading builds…" />}

        {data && data.builds.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No builds are being shared yet. Meanwhile, try the{' '}
            <Link href="/construction-estimate" style={{ color: ACCENT_BLUE, fontWeight: 700 }}>cost estimator</Link>.
          </p>
        )}

        {data && data.builds.length > 0 && (
          <>
            <div className="rb-grid">
              {data.builds.map((b) => (
                <BuildCard key={b.id} b={b} />
              ))}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {data.notes.join(' ')}
              {data.is_stale ? ' Some figures are older than expected.' : ''}
              {' '}Confidence {Math.round(data.confidence_score * 100)}%.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
