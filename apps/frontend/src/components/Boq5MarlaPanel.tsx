'use client';

import {
  BOQ_5_MARLA,
  BOQ_5_MARLA_PRE_CONSTRUCTION,
  BOQ_5_MARLA_SOURCE,
  BOQ_PROJECT_SPEC,
  BOQ_RULES_OF_THUMB,
  perSqft,
  boqConstructionTotal,
  boqGroupTotal,
} from '@/lib/boq5Marla';
import { RADIUS } from '@/styles/tokens';

function pkr(n: number): string {
  return `Rs ${n.toLocaleString('en-PK')}`;
}

export default function Boq5MarlaPanel() {
  const total = boqConstructionTotal();
  const pre = BOQ_5_MARLA_PRE_CONSTRUCTION.reduce((s, r) => s + r.cost, 0);
  return (
    <aside
      aria-label="Reference BOQ for a 5 Marla house"
      style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: RADIUS.md, overflow: 'hidden' }}
    >
      <div style={{ padding: '14px 16px', background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800 }}>5 Marla BOQ — reference</h2>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
          What a complete 5 Marla class house needs and costs. Based on {BOQ_5_MARLA_SOURCE}. Indicative only — your
          prices will differ.
        </p>
        <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--text)' }}>
          {BOQ_PROJECT_SPEC.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div style={{ padding: '8px 16px 4px' }}>
        {BOQ_5_MARLA.map((g) => (
          <details key={g.title} open style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <summary style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', listStyle: 'none', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700 }}>{g.title}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, textAlign: 'right' }}>
                {pkr(boqGroupTotal(g))}
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 400, color: 'var(--muted)' }}>
                  Rs {perSqft(boqGroupTotal(g)).toLocaleString('en-PK')} / sq ft
                </span>
              </span>
            </summary>
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {g.rows.map((r) => (
                <div key={r.item} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div>{r.item}</div>
                    {(r.quantity || r.note) && (
                      <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                        {[r.quantity, r.note].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{pkr(r.cost)}</div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 }}>
          <span>Construction total</span>
          <span>{pkr(total)}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>
          ≈ Rs {perSqft(total).toLocaleString('en-PK')} per sq ft covered
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)' }}>
          <span>Before construction (soil test, approvals, etc.)</span>
          <span>{pkr(pre)}</span>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Rules of thumb (per sq ft covered)</div>
          {BOQ_RULES_OF_THUMB.map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span>{r.label}</span>
              <span style={{ color: 'var(--muted)' }}>{r.value}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
          Land cost is not included. Quantities come from one completed house and vary with design, floors and finish.
        </p>
      </div>
    </aside>
  );
}
