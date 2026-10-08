'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/components/BackLink';
import { BUILD_JOURNEY, JOURNEY_STEP_COUNT } from '@/lib/buildJourney';
import { PHASE_STYLES } from '@/lib/buildPhases';

const STORAGE_KEY = 'siraat-build-guide-done';
// Site-order build steps shown inside step "Build, step by step".
const SITE_PHASES = PHASE_STYLES.filter((p) => p.step >= 5 && p.step <= 17);

const CSS = `
.bg-link{font-size:13px;font-weight:700;text-decoration:none;border-radius:99px;padding:6px 12px;border:1.5px solid var(--c);color:var(--c);background:#fff}
.bg-link:hover{background:var(--c);color:#fff}
.bg-phases{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:640px){.bg-phases{grid-template-columns:1fr 1fr}}
`;

export default function BuildGuidePage() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch {
      /* storage unavailable: the guide still works, progress just is not kept */
    }
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const doneCount = BUILD_JOURNEY.flatMap((s) => s.steps).filter((st) => done[st.id]).length;
  const pct = Math.round((doneCount / JOURNEY_STEP_COUNT) * 100);
  let n = 0;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 48px' }}>
      <style>{CSS}</style>
      <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>BUILD GUIDE</p>
          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2 }}>Steps to build a home</h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', marginTop: '6px' }}>
            From buying the plot to moving in, in the order it happens. Tick each step as you finish it. Your progress is saved on this device.
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
            <span>{doneCount} of {JOURNEY_STEP_COUNT} steps done</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: '10px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', transition: 'width .2s' }} />
          </div>
        </div>

        {BUILD_JOURNEY.map((stage) => (
          <section key={stage.key} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: stage.ink,
                background: stage.tint,
                borderLeft: `6px solid ${stage.color}`,
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              {stage.title}
            </h2>

            {stage.steps.map((step) => {
              n += 1;
              const isDone = !!done[step.id];
              return (
                <article
                  key={step.id}
                  style={{
                    ['--c' as string]: stage.color,
                    background: isDone ? '#f9fafb' : '#fff',
                    border: '1px solid var(--border)',
                    borderLeft: `6px solid ${stage.color}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    gap: '14px',
                    opacity: isDone ? 0.75 : 1,
                  } as React.CSSProperties}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: stage.color,
                      color: '#fff',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {n}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, lineHeight: 1.3, textDecoration: isDone ? 'line-through' : 'none' }}>
                        {step.title}
                        {step.added && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: stage.ink, background: stage.tint, borderRadius: '99px', padding: '2px 8px', verticalAlign: 'middle' }}>
                            Often missed
                          </span>
                        )}
                      </h3>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, flexShrink: 0, cursor: 'pointer' }}>
                        <input type="checkbox" checked={isDone} onChange={() => toggle(step.id)} style={{ width: '18px', height: '18px' }} />
                        Done
                      </label>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--muted)' }}>{step.summary}</p>

                    {step.tasks.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
                        {step.tasks.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    )}

                    {step.id === 'build' && (
                      <div className="bg-phases">
                        {SITE_PHASES.map((p, i) => (
                          <div
                            key={p.key}
                            style={{ background: p.tint, borderLeft: `5px solid ${p.color}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, color: p.ink }}
                          >
                            {i + 1}. {p.title}
                          </div>
                        ))}
                      </div>
                    )}

                    {step.links && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                        {step.links.map((l) => (
                          <Link key={l.href + l.label} href={l.href} className="bg-link">
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ))}

        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          Fees, taxes and approval rules differ by society and city and change often. Always confirm the current figures with your society office and the relevant authority.
        </p>
      </div>
    </main>
  );
}
