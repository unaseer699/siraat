'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicBuild, PublicBuildExpensesResponse } from '@siraat/shared-types';
import { Spinner } from '@/components/Spinner';
import { fetchPublicBuild, fetchPublicBuildExpenses } from '@/lib/api';
import { phaseSlug } from '@/lib/phaseSlug';
import { sectionLabel } from '@/lib/sectionCategories';
import { ACCENT_BLUE } from '@/styles/tokens';

function pkr(n: number): string {
  return `PKR ${Math.round(n).toLocaleString('en-PK')}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CSS = `
.rbd-phase { background:#fff; border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.rbd-phase > summary { list-style:none; cursor:pointer; display:flex; justify-content:space-between; gap:12px; padding:14px 16px; background:#f9fafb; font-weight:800; font-size:16px; }
.rbd-phase > summary::-webkit-details-marker { display:none; }
.print-only { display:none; }
@media print {
  .no-print { display:none !important; }
  .print-only { display:block !important; }
  header, nav { display:none !important; }
  main { padding:0 !important; min-height:0 !important; }
  .rbd-phase { break-inside:auto; box-shadow:none; }
  .rbd-section { break-inside:avoid; }
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
@page { margin: 14mm; }
`;

export default function RealBuildDetailPage({ params }: { params: { id: string } }) {
  const [exp, setExp] = useState<PublicBuildExpensesResponse | null>(null);
  const [build, setBuild] = useState<PublicBuild | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([fetchPublicBuildExpenses(params.id), fetchPublicBuild(params.id).catch(() => null)])
      .then(([e, b]) => {
        setExp(e);
        setBuild(b?.builds[0] ?? null);
      })
      .catch(() => setError(true));
  }, [params.id]);

  // Open and scroll to the phase named in the link (#phase-structure).
  useEffect(() => {
    if (!exp || exp.state !== 'FULL') return;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.scrollIntoView({ block: 'start' });
    }
  }, [exp]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 48px' }}>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Link href="/real-builds" className="no-print" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
          ← All real builds
        </Link>

        {error && <p style={{ color: 'var(--error)', fontSize: '14px' }}>Could not load this build. Please try again shortly.</p>}
        {!exp && !error && <Spinner label="Loading expenses…" />}
        {exp && exp.state === 'NOT_COVERED' && (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>This build is not shared, or has no expenses recorded yet.</p>
        )}

        {exp && exp.state === 'FULL' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <p className="print-only" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>
                  SIRAAT · REAL BUILD EXPENSE REPORT · {fmtDate(new Date().toISOString())}
                </p>
                <p className="no-print" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>REAL BUILD</p>
                <h1 style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.25 }}>{exp.title}</h1>
                {build && (
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                    {[
                      build.status === 'COMPLETE' ? 'Completed' : build.status === 'ON_HOLD' ? 'On hold' : 'In progress',
                      build.covered_area_sqft !== null ? `${build.covered_area_sqft.toLocaleString('en-US')} sq ft covered` : null,
                      build.floors !== null ? `${build.floors} ${build.floors === 1 ? 'floor' : 'floors'}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="no-print"
                onClick={() => {
                  document.querySelectorAll<HTMLDetailsElement>('details.rbd-phase').forEach((d) => (d.open = true));
                  window.print();
                }}
                style={{ padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
              >
                Download / Print PDF
              </button>
            </div>

            <div style={{ background: '#111', color: '#fff', borderRadius: '14px', padding: '16px 20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8, letterSpacing: '0.04em' }}>TOTAL SPENT</div>
              <div style={{ fontSize: '30px', fontWeight: 800 }}>{pkr(exp.total)}</div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '8px', fontSize: '12px', opacity: 0.85 }}>
                {exp.phases.map((p) => (
                  <a key={p.label} href={`#${phaseSlug(p.label)}`} className="no-print" style={{ color: '#fff' }}>
                    {p.label}: {pkr(p.total)}
                  </a>
                ))}
              </div>
            </div>

            {exp.phases.map((p) => (
              <details key={p.label} id={phaseSlug(p.label)} className="rbd-phase" open>
                <summary>
                  <span>{p.label}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{pkr(p.total)}</span>
                </summary>
                <div style={{ padding: '4px 16px 12px' }}>
                  {p.sections.map((s) => (
                    <div key={s.category} className="rbd-section" style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '14px', fontWeight: 700, color: ACCENT_BLUE, paddingBottom: '4px' }}>
                        <span>{sectionLabel(s.category)}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{pkr(s.subtotal)}</span>
                      </div>
                      {s.expenses.map((e, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: '13px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{e.description}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                              {fmtDate(e.date)}
                              {e.quantity !== null && e.unit ? ` · ${e.quantity.toLocaleString('en-US')} ${e.unit.toLowerCase()}` : ''}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', color: e.amount < 0 ? 'var(--error)' : undefined }}>
                            {e.amount < 0 ? '−' : ''}
                            {pkr(Math.abs(e.amount))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            ))}

            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Shared by the owner. Owner-reported costs, shown as entered. Not a verification of any contractor or supplier. Prepared from siraat.ai.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
