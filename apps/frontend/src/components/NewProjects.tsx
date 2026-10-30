'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { NEW_PROJECTS } from '@/lib/newProjects';
import { TRUST_GREEN, TRUST_GREEN_BG, TRUST_GREEN_BORDER, TRUST_GREEN_TEXT, WARNING_AMBER, RADIUS } from '@/styles/tokens';

const FIRST = 4;
const fmt = (n: number) => n.toLocaleString();

// "New projects" for the home page. Official, regulator-published projects only.
// Siraat has not reviewed them yet, and the section says so on every card.
export function NewProjects() {
  const [all, setAll] = useState(false);
  const shown = all ? NEW_PROJECTS : NEW_PROJECTS.slice(0, FIRST);
  return (
    <section
      id="new-projects"
      style={{ width: '100%', maxWidth: '960px', background: '#fff', border: '1px solid var(--border)', borderRadius: RADIUS.lg, padding: '24px 20px' }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Building2 size={22} color={TRUST_GREEN} aria-hidden="true" />
        New affordable projects
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Private schemes approved by Punjab&rsquo;s housing agency (PHATA), with the plots they must reserve for affordable housing.
        We list them from the official page. We have not reviewed them yet, so this is not advice to buy.
      </p>
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
              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Siraat review: pending
              </span>
            </div>
            {p.caution && (
              <p style={{ fontSize: '12px', margin: 0, color: WARNING_AMBER, lineHeight: 1.4 }}>{p.caution}</p>
            )}
            <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', marginTop: 'auto' }}>
              Official source
            </a>
          </li>
        ))}
      </ul>
      {NEW_PROJECTS.length > FIRST && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          style={{ marginTop: '14px', background: 'none', border: 'none', color: 'var(--accent, #2563eb)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '14px' }}
        >
          {all ? 'Show fewer' : `Show all ${NEW_PROJECTS.length} projects`}
        </button>
      )}
    </section>
  );
}
