'use client';

import { useState } from 'react';
import Link from 'next/link';
import { checkUnapprovedScheme } from '@/lib/api';
import { DANGER_RED, TRUST_GREEN_BG, TRUST_GREEN_BORDER, TRUST_GREEN_TEXT, RADIUS } from '@/styles/tokens';
import type { UnapprovedSchemeCheckResponse } from '@siraat/shared-types';

function regulatorsOf(r: UnapprovedSchemeCheckResponse): string {
  return [...new Set(r.matches.map((m) => m.regulator))].join(' / ') || 'The regulator';
}

// "Is this scheme on CDA's unapproved list?" A SIMILAR result is worded as a
// hint to check, never as a claim that two names are the same scheme.
export function SchemeCheck() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<UnapprovedSchemeCheckResponse | null>(null);
  const [asked, setAsked] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 3) return;
    setBusy(true);
    setError(null);
    try {
      setRes(await checkUnapprovedScheme(n));
      setAsked(n);
    } catch {
      setError('Could not check right now. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '680px' }}>
      <p style={{ fontSize: '14px', fontWeight: 800, margin: 0 }}>Check a scheme against the CDA / RDA / LDA / PDA unapproved lists</p>
      <form onSubmit={run} style={{ display: 'flex', gap: '8px' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Scheme name, e.g. Ghouri Town"
          aria-label="Scheme name to check"
          style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: RADIUS.md, fontSize: '15px' }}
        />
        <button
          type="submit"
          disabled={busy || name.trim().length < 3}
          style={{ padding: '10px 18px', background: '#fff', color: DANGER_RED, border: `1px solid ${DANGER_RED}`, borderRadius: RADIUS.md, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}
        >
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>
      {error && <p style={{ color: DANGER_RED, fontSize: '13px', margin: 0 }}>{error}</p>}
      {res && res.match !== 'NONE' && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: `4px solid ${DANGER_RED}`, borderRadius: RADIUS.md, padding: '12px 14px', fontSize: '13px', lineHeight: 1.5 }}>
          <strong>
            {res.match === 'EXACT'
              ? `${regulatorsOf(res)} lists "${asked}" as having no approval or NOC.`
              : `"${asked}" is similar to a name ${regulatorsOf(res)} lists as unapproved. It may or may not be the same scheme.`}
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
            {res.matches.map((m) => (
              <li key={m.id}>
                {m.name}
                {m.location ? `, ${m.location}` : ''} ({m.regulator})
              </li>
            ))}
          </ul>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>{res.disclaimer}</p>
          <Link href="/illegal-schemes" style={{ fontWeight: 700, color: DANGER_RED }}>
            See the full list →
          </Link>
        </div>
      )}
      {res && res.match === 'NONE' && (
        <div style={{ background: TRUST_GREEN_BG, border: `1px solid ${TRUST_GREEN_BORDER}`, color: TRUST_GREEN_TEXT, borderRadius: RADIUS.md, padding: '12px 14px', fontSize: '13px', lineHeight: 1.5 }}>
          &ldquo;{asked}&rdquo; is not on the CDA, RDA, LDA or PDA lists we hold
          {res.listed_as_of ? ` (read ${new Date(res.listed_as_of).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}.
          That does not prove it is approved — confirm with CDA before buying.
        </div>
      )}
    </div>
  );
}
