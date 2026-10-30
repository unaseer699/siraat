'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { NEW_PROJECTS, PROJECT_SOURCES } from '@/lib/newProjects';
import { TRUST_GREEN, TRUST_GREEN_BG, TRUST_GREEN_BORDER, TRUST_GREEN_TEXT, WARNING_AMBER, RADIUS } from '@/styles/tokens';

const REGIONS = ['All', ...Array.from(new Set(NEW_PROJECTS.map((p) => p.region)))];
const fmt = (n: number) => n.toLocaleString();

// "New projects" for the home page. Official, regulator-published projects only.
// Siraat has not reviewed them yet, and the section says so on every card.
export function NewProjects() {
  const [region, setRegion] = useState('All');
  const shown = region === 'All' ? NEW_PROJECTS : NEW_PROJECTS.filter((p) => p.region === region);
  return (
    <section
      id="new-projects"
      style={{ width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: RADIUS.lg, padding: '24px 20px' }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Building2 size={22} color={TRUST_GREEN} aria-hidden="true" />
        New affordable projects
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Private schemes approved by Punjab&rsquo;s housing agency (PHATA), with the plots they must reserve for affordable housing.
        We copy them from the official page and show the source on every card.
        This is information, not advice to buy. Check each project with the authority yourself before you invest; you decide and you carry the risk.
      </p>
      <div role="group" aria-label="Region" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            aria-pressed={region === r}
            style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: `1px solid ${region === r ? TRUST_GREEN : 'var(--border)'}`, background: region === r ? TRUST_GREEN_BG : '#fff', color: region === r ? TRUST_GREEN_TEXT : 'var(--text)' }}
          >
            {r}
          </button>
        ))}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {shown.map((p) => (
          <li key={p.name} style={{ border: '1px solid var(--border)', borderRadius: RADIUS.md, padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <strong style={{ fontSize: '15px', display: 'block' }}>{p.name}</strong>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{p.place}</span>
            </div>
            <div style={{ fontSize: '14px' }}>
              <strong>{fmt(p.affordablePlots)}</strong> affordable plots · {p.plotSizes}
              {p.apartments ? <> · {fmt(p.apartments)} apartments</> : null}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: TRUST_GREEN_BG, border: `1px solid ${TRUST_GREEN_BORDER}`, color: TRUST_GREEN_TEXT }}>
                {p.authority} approved
              </span>
              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                {p.status}
              </span>
              {p.siraatReview === 'REVIEWED' ? (
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: TRUST_GREEN_BG, border: `1px solid ${TRUST_GREEN_BORDER}`, color: TRUST_GREEN_TEXT }}>
                  Reviewed by Siraat
                </span>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', border: `1px solid ${WARNING_AMBER}`, color: '#92400e' }}>
                  Not reviewed by Siraat – verify yourself
                </span>
              )}
            </div>
            {p.caution && (
              <p style={{ fontSize: '12px', margin: 0, color: '#92400e', lineHeight: 1.4 }}>{p.caution}</p>
            )}
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', marginTop: 'auto' }}>
              Source: {p.authority} official page ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProjectSources() {
  return (
    <section aria-label="Other official sources" style={{ width: '100%', border: '1px solid var(--border)', borderRadius: RADIUS.md, padding: '14px 16px', background: '#fff', fontSize: '13px', lineHeight: 1.5 }}>
      <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px' }}>Where to find more projects</h2>
      <p style={{ margin: '0 0 8px', color: 'var(--muted)' }}>These are the authorities that publish approved schemes. Go to the source and check a project there before you invest.</p>
      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {PROJECT_SOURCES.map((s) => (
          <li key={s.short}>
            <strong>{s.short}</strong> · {s.name} ({s.covers}){' '}
            <a href={s.url} target="_blank" rel="noopener noreferrer">Official site ↗</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
