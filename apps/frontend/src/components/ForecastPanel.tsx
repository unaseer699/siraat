'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  fetchProjectForecast,
  saveProjectLayout,
  confirmProjectLayout,
  type ProjectForecast,
  type FinishLevel,
  type ForecastGroupKey,
} from '@/lib/api';

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const FACTOR_GROUPS: { key: ForecastGroupKey; label: string }[] = [
  { key: 'STRUCTURE', label: 'Structure' },
  { key: 'SERVICES', label: 'Services' },
  { key: 'FINISHING', label: 'Finishing' },
  { key: 'SITE_OTHER', label: 'Site & Other' },
];
const DEFAULT_FLOORS = [
  { name: 'Ground floor', area: '', drawing: '', allowed: '' },
  { name: 'First floor', area: '', drawing: '', allowed: '' },
  { name: 'Mumty', area: '', drawing: '', allowed: '' },
];

const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: '24px', background: '#fff' };
const input: CSSProperties = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' };
const btn: CSSProperties = { fontSize: '13px', fontWeight: 600, padding: '8px 14px', border: 'none', borderRadius: 'var(--radius)', background: '#111', color: '#fff', cursor: 'pointer' };
const th: CSSProperties = { textAlign: 'left', fontSize: '12px', color: 'var(--muted)', padding: '4px 8px', borderBottom: '1px solid var(--border)' };
const td: CSSProperties = { fontSize: '13px', padding: '6px 8px', borderBottom: '1px solid var(--border)' };

export function ForecastPanel({ projectId }: { projectId: string }) {
  const [fc, setFc] = useState<ProjectForecast | null>(null);
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [finish, setFinish] = useState<FinishLevel>('STANDARD');
  const [factors, setFactors] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function load(f: ProjectForecast) {
    setFc(f);
    if (f.layout) {
      setFloors(f.layout.floors.map((x) => ({ name: x.name, area: String(x.area_sqft), drawing: x.drawing_area_sqft != null ? String(x.drawing_area_sqft) : '', allowed: x.allowed_area_sqft != null ? String(x.allowed_area_sqft) : '' })));
      setFinish(f.layout.finish_level);
      setFactors(Object.fromEntries(Object.entries(f.layout.price_factors).map(([k, v]) => [k, String(v)])));
      setNote(f.layout.source_note ?? '');
    }
  }

  useEffect(() => {
    fetchProjectForecast(projectId).then(load).catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load'));
  }, [projectId]);

  async function run(fn: () => Promise<ProjectForecast>) {
    setBusy(true);
    setErr(null);
    try {
      load(await fn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const rows = floors.filter((f) => f.name.trim() && Number(f.area) > 0).map((f) => ({ name: f.name.trim(), area_sqft: Number(f.area), drawing_area_sqft: Number(f.drawing) > 0 ? Number(f.drawing) : null, allowed_area_sqft: Number(f.allowed) > 0 ? Number(f.allowed) : null }));
    if (rows.length === 0) return setErr('Enter the covered area for at least one floor');
    const pf: Partial<Record<ForecastGroupKey, number>> = {};
    for (const g of FACTOR_GROUPS) {
      const v = Number(factors[g.key]);
      if (factors[g.key] && v > 0 && v !== 1) pf[g.key] = v;
    }
    run(() => saveProjectLayout(projectId, { floors: rows, finish_level: finish, price_factors: Object.keys(pf).length ? pf : null, source_note: note || null }));
  }

  const confirmed = fc?.layout?.status === 'CONFIRMED';

  return (
    <section style={box}>
      <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>Layout &amp; cost forecast</h2>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px' }}>
        Enter the covered area per floor from the architect&apos;s drawings. Areas stay unconfirmed until you confirm them.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '2px', fontSize: '11px', color: 'var(--muted)' }}>
        <span style={{ flex: 1 }}>Floor</span>
        <span style={{ width: '110px' }}>Area used (sq ft)</span>
        <span style={{ width: '110px' }}>Per drawing</span>
        <span style={{ width: '110px' }}>Allowable</span>
      </div>
      {floors.map((f, i) => {
        const set = (k: 'name' | 'area' | 'drawing' | 'allowed', v: string) => setFloors(floors.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
        const diff = Number(f.drawing) > 0 && Number(f.area) > 0 && Number(f.area) !== Number(f.drawing);
        const over = Number(f.allowed) > 0 && Number(f.area) > Number(f.allowed);
        return (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
            <input style={{ ...input, flex: 1 }} value={f.name} onChange={(e) => set('name', e.target.value)} />
            <input style={{ ...input, width: '110px', borderColor: diff || over ? '#b45309' : undefined }} inputMode="decimal" placeholder="sq ft" value={f.area} onChange={(e) => set('area', e.target.value)} />
            <input style={{ ...input, width: '110px' }} inputMode="decimal" placeholder="drawing" value={f.drawing} onChange={(e) => set('drawing', e.target.value)} />
            <input style={{ ...input, width: '110px' }} inputMode="decimal" placeholder="allowable" value={f.allowed} onChange={(e) => set('allowed', e.target.value)} />
            {(diff || over) && <span style={{ fontSize: '11px', color: '#b45309' }}>{diff ? 'differs from drawing' : ''}{diff && over ? ' · ' : ''}{over ? 'over allowable' : ''}</span>}
          </div>
        );
      })}
      <button type="button" style={{ ...input, cursor: 'pointer', marginBottom: '12px' }} onClick={() => setFloors([...floors, { name: '', area: '', drawing: '', allowed: '' }])}>+ Add floor</button>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <label style={{ fontSize: '12px' }}>Finish level<br />
          <select style={input} value={finish} onChange={(e) => setFinish(e.target.value as FinishLevel)}>
            <option value="BASIC">Basic</option>
            <option value="STANDARD">Standard</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </label>
        {FACTOR_GROUPS.map((g) => (
          <label key={g.key} style={{ fontSize: '12px' }}>{g.label} price ×<br />
            <input style={{ ...input, width: '70px' }} inputMode="decimal" placeholder="1.00" value={factors[g.key] ?? ''} onChange={(e) => setFactors({ ...factors, [g.key]: e.target.value })} />
          </label>
        ))}
        <label style={{ fontSize: '12px', flex: 1, minWidth: '160px' }}>Source note<br />
          <input style={{ ...input, width: '100%' }} placeholder="e.g. Architect drawings Aug 2026" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button type="button" style={btn} disabled={busy} onClick={save}>Save &amp; forecast</button>
        {fc?.layout && !confirmed && (
          <button type="button" style={{ ...btn, background: '#166534' }} disabled={busy} onClick={() => run(() => confirmProjectLayout(projectId))}>
            Confirm areas
          </button>
        )}
      </div>
      {err && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{err}</p>}

      {fc && fc.state !== 'NOT_COVERED' && (
        <>
          <p style={{ fontSize: '13px', margin: '0 0 8px' }}>
            <strong>{fc.layout!.total_area_sqft.toLocaleString()} sq ft</strong> ·{' '}
            {confirmed ? 'areas confirmed' : 'areas NOT confirmed (provisional)'} · confidence {Math.round(fc.confidence_score * 100)}%
            {fc.is_stale ? ' · reference prices are stale' : ''}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
            <thead>
              <tr><th style={th}>Group</th><th style={th}>Estimated</th><th style={th}>Spent</th><th style={th}>Remaining</th><th style={th}>Forecast</th></tr>
            </thead>
            <tbody>
              {fc.groups.filter((g) => g.estimated !== null || g.spent > 0).map((g) => (
                <tr key={g.group}>
                  <td style={td}>{g.label}</td>
                  <td style={td}>{g.estimated === null ? '—' : pkr(g.estimated)}</td>
                  <td style={td}>{pkr(g.spent)}</td>
                  <td style={td}>{pkr(g.remaining)}</td>
                  <td style={td}>{pkr(g.forecast_at_completion)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }}>Total</td>
                <td style={{ ...td, fontWeight: 700 }}>{pkr(fc.estimated_total)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{pkr(fc.spent_total)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{pkr(Math.max(fc.forecast_total - fc.spent_total, 0))}</td>
                <td style={{ ...td, fontWeight: 700 }}>{pkr(fc.forecast_total)}{fc.per_sqft ? ` (${pkr(fc.per_sqft)}/sq ft)` : ''}</td>
              </tr>
            </tbody>
          </table>
          {fc.notes.map((n) => (
            <p key={n} style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0' }}>{n}</p>
          ))}
        </>
      )}
    </section>
  );
}
