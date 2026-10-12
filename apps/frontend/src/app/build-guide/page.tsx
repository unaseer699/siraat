'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackLink } from '@/components/BackLink';
import { BUILD_JOURNEY, JOURNEY_STEP_COUNT } from '@/lib/buildJourney';
import { PHASE_STYLES } from '@/lib/buildPhases';
import { STAGE_TITLE_UR, STEP_UR, PHASE_TITLE_UR, UI_UR } from '@/lib/buildJourneyUr';

const STORAGE_KEY = 'siraat-build-guide-done';
const LANG_KEY = 'siraat-build-guide-lang';
// Site-order build steps shown inside step "Build, step by step".
const SITE_PHASES = PHASE_STYLES.filter((p) => p.step >= 5 && p.step <= 17);

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
.bg-link{font-size:13px;font-weight:700;text-decoration:none;border-radius:99px;padding:6px 12px;border:1.5px solid var(--c);color:var(--c);background:#fff}
.bg-link:hover{background:var(--c);color:#fff}
.bg-phases{display:grid;grid-template-columns:1fr;gap:8px}
@media(min-width:640px){.bg-phases{grid-template-columns:1fr 1fr}}
.bg-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.bg-chip{flex:0 0 auto;font-size:13px;font-weight:700;text-decoration:none;border-radius:99px;padding:8px 14px;border:1.5px solid var(--c);color:var(--c);background:#fff;white-space:nowrap}
.bg-ur{font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Noto Naskh Arabic','Segoe UI',Tahoma,serif;line-height:2.1}
.bg-ur h1,.bg-ur h2{line-height:2}
.bg-ur .bg-row{text-align:right}
.bg-lang{display:inline-flex;border:1.5px solid var(--border);border-radius:99px;overflow:hidden;background:#fff}
.bg-lang button{font-size:14px;font-weight:700;padding:6px 14px;border:0;background:none;cursor:pointer;color:var(--text)}
.bg-lang button[aria-pressed=true]{background:#16a34a;color:#fff}
.bg-row{width:100%;display:flex;align-items:center;gap:12px;text-align:left;background:none;border:0;padding:0;cursor:pointer;font:inherit;color:inherit}
`;

export default function BuildGuidePage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [lang, setLang] = useState<'en' | 'ur'>('en');
  const ur = lang === 'ur';

  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      /* storage unavailable: the guide still works, progress just is not kept */
    }
    setDone(saved);
    try {
      if (window.localStorage.getItem(LANG_KEY) === 'ur') setLang('ur');
    } catch {
      /* ignore */
    }
    // Open only the next step to do, so the page starts short and focused.
    const next = BUILD_JOURNEY.flatMap((st) => st.steps).find((st) => !saved[st.id]);
    if (next) setOpen({ [next.id]: true });
    setReady(true);
  }, []);

  function chooseLang(l: 'en' | 'ur') {
    setLang(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }

  const stepTitle = (st: { id: string; title: string }) => (ur ? STEP_UR[st.id]?.title ?? st.title : st.title);
  const stageTitle = (sg: { key: string; title: string }) => (ur ? STAGE_TITLE_UR[sg.key] ?? sg.title : sg.title);

  function toggleDone(id: string) {
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

  const allSteps = BUILD_JOURNEY.flatMap((s) => s.steps);
  const doneCount = allSteps.filter((st) => done[st.id]).length;
  const pct = Math.round((doneCount / JOURNEY_STEP_COUNT) * 100);
  const nextStep = allSteps.find((st) => !done[st.id]);
  const allOpen = allSteps.every((st) => open[st.id]);

  function goToNext() {
    if (!nextStep) return;
    setOpen((p) => ({ ...p, [nextStep.id]: true }));
    setTimeout(() => document.getElementById(`step-${nextStep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  let n = 0;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 48px' }}>
      <style>{CSS}</style>
      <div
        className={ur ? 'bg-ur' : undefined}
        lang={ur ? 'ur' : 'en'}
        dir={ur ? 'rtl' : 'ltr'}
        style={{ width: '100%', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '18px' }}
      >
        <div dir="ltr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <BackLink />
          <div className="bg-lang" role="group" aria-label="Language">
            <button type="button" aria-pressed={!ur} onClick={() => chooseLang('en')}>English</button>
            <button type="button" aria-pressed={ur} onClick={() => chooseLang('ur')}>اردو</button>
          </div>
        </div>

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>{ur ? UI_UR.eyebrow : 'BUILD GUIDE'}</p>
          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.2 }}>{ur ? UI_UR.heading : 'Steps to build a home'}</h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', marginTop: '6px' }}>
            {ur ? UI_UR.intro(JOURNEY_STEP_COUNT) : `${JOURNEY_STEP_COUNT} steps in 5 stages, from buying the plot to moving in. Tap a step to see what to do. Tick it when finished.`}
          </p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700 }}>
            <span>{ur ? UI_UR.progress(doneCount, JOURNEY_STEP_COUNT) : `${doneCount} of ${JOURNEY_STEP_COUNT} steps done`}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: '10px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#16a34a', transition: 'width .2s' }} />
          </div>
          {ready && nextStep && (
            <button
              type="button"
              onClick={goToNext}
              style={{ alignSelf: 'flex-start', fontSize: '14px', fontWeight: 800, color: '#fff', background: '#16a34a', border: 'none', borderRadius: '99px', padding: '10px 18px', cursor: 'pointer' }}
            >
              {ur ? UI_UR.nextBtn(stepTitle(nextStep)) : `Next: ${nextStep.title} →`}
            </button>
          )}
          {ready && !nextStep && <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#166534' }}>{ur ? UI_UR.allDone : 'All steps done. Congratulations!'}</p>}
        </div>

        <nav aria-label="Stages" className="bg-chips">
          {BUILD_JOURNEY.map((stage, i) => (
            <a key={stage.key} href={`#stage-${stage.key}`} className="bg-chip" style={{ ['--c' as string]: stage.color } as React.CSSProperties}>
              {i + 1}. {stageTitle(stage)}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? {} : Object.fromEntries(allSteps.map((st) => [st.id, true])))}
            style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {allOpen ? (ur ? UI_UR.collapse : 'Collapse all') : ur ? UI_UR.showAll : 'Show all details'}
          </button>
        </div>

        {BUILD_JOURNEY.map((stage, si) => {
          const stageDone = stage.steps.filter((st) => done[st.id]).length;
          return (
            <section key={stage.key} id={`stage-${stage.key}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px', scrollMarginTop: '16px' }}>
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: stage.ink,
                  background: stage.tint,
                  [ur ? 'borderRight' : 'borderLeft']: `6px solid ${stage.color}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  margin: 0,
                }}
              >
                <span>
                  {ur ? `${UI_UR.stage(si + 1)}: ` : `Stage ${si + 1}: `}
                  {stageTitle(stage)}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                  {stageDone}/{stage.steps.length}
                </span>
              </h2>

              {stage.steps.map((step) => {
                n += 1;
                const isDone = !!done[step.id];
                const isOpen = !!open[step.id];
                const isNext = ready && nextStep?.id === step.id;
                return (
                  <article
                    key={step.id}
                    id={`step-${step.id}`}
                    style={{
                      ['--c' as string]: stage.color,
                      background: isDone ? '#f9fafb' : '#fff',
                      border: isNext ? `2px solid ${stage.color}` : '1px solid var(--border)',
                      [ur ? 'borderRight' : 'borderLeft']: `6px solid ${stage.color}`,
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      scrollMarginTop: '16px',
                    } as React.CSSProperties}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        className="bg-row"
                        aria-expanded={isOpen}
                        onClick={() => setOpen((p) => ({ ...p, [step.id]: !p[step.id] }))}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            flexShrink: 0,
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isDone ? '#16a34a' : stage.color,
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isDone ? '✓' : n}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '16px', fontWeight: 800, lineHeight: 1.3, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--muted)' : 'var(--text)' }}>
                            {stepTitle(step)}
                          </span>
                          {isNext && !isOpen && (
                            <span style={{ fontSize: '12px', fontWeight: 700, color: stage.ink }}>{ur ? UI_UR.next : 'Next step'}</span>
                          )}
                          {step.added && (
                            <span style={{ marginTop: '2px', display: 'inline-block', fontSize: '11px', fontWeight: 700, color: stage.ink, background: stage.tint, borderRadius: '99px', padding: '2px 8px' }}>
                              {ur ? UI_UR.often : 'Often missed'}
                            </span>
                          )}
                        </span>
                        <span aria-hidden="true" style={{ color: 'var(--muted)', fontSize: '18px', transform: isOpen ? 'rotate(90deg)' : ur ? 'scaleX(-1)' : 'none', transition: 'transform .15s' }}>›</span>
                      </button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, flexShrink: 0, cursor: 'pointer' }}>
                        <input type="checkbox" checked={isDone} onChange={() => toggleDone(step.id)} style={{ width: '18px', height: '18px' }} />
                        {ur ? UI_UR.done : 'Done'}
                      </label>
                    </div>

                    {isOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', [ur ? 'paddingRight' : 'paddingLeft']: '44px' }}>
                        <p style={{ fontSize: '14px', color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>{ur ? STEP_UR[step.id]?.summary ?? step.summary : step.summary}</p>

                        {step.tasks.length > 0 && (
                          <ul style={{ margin: 0, [ur ? 'paddingRight' : 'paddingLeft']: '20px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: 'var(--muted)' }}>
                            {(ur ? STEP_UR[step.id]?.tasks ?? step.tasks : step.tasks).map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        )}

                        {step.id === 'build' && (
                          <div className="bg-phases">
                            {SITE_PHASES.map((p, i) => (
                              <div
                                key={p.key}
                                style={{ background: p.tint, [ur ? 'borderRight' : 'borderLeft']: `5px solid ${p.color}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontWeight: 700, color: p.ink }}
                              >
                                {i + 1}. {ur ? PHASE_TITLE_UR[p.key] ?? p.title : p.title}
                              </div>
                            ))}
                          </div>
                        )}

                        {step.links && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {step.links.map((l, li) => (
                              <Link key={l.href + l.label} href={l.href} className="bg-link">
                                {ur ? `${STEP_UR[step.id]?.links?.[li] ?? l.label} ←` : `${l.label} →`}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}

        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {ur
            ? UI_UR.disclaimer
            : 'Fees, taxes and approval rules differ by society and city and change often. Always confirm the current figures with your society office and the relevant authority.'}
        </p>
      </div>
    </main>
  );
}
