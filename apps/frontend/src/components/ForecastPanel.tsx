'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  fetchProjectForecast,
  saveProjectLayout,
  confirmProjectLayout,
  saveProjectProgress,
  listAdminProjectDocuments,
  uploadProjectDocument,
  setProjectDocumentVisibility,
  deleteProjectDocument,
  extractLayoutFromDocument,
  type ProjectDocument,
  type ProjectDocumentKind,
  type LayoutExtraKind,
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
const EXTRA_KINDS: { value: LayoutExtraKind; label: string }[] = [
  { value: 'FRONT_SHADE', label: 'Front shade' },
  { value: 'BACK_SHADE', label: 'Back shade' },
  { value: 'PORCH', label: 'Porch' },
  { value: 'BALCONY', label: 'Balcony' },
];
const DOC_KINDS: { value: ProjectDocumentKind; label: string }[] = [
  { value: 'ARCHITECTURAL', label: 'Architectural drawings' },
  { value: 'STRUCTURAL', label: 'Structural drawings' },
  { value: 'ELECTRICAL', label: 'Electrical drawings' },
  { value: 'PLUMBING', label: 'Plumbing drawings' },
  { value: 'SOIL', label: 'Soil report' },
  { value: 'OTHER', label: 'Other' },
];
const DEFAULT_BOUNDARY_RATE = '5500';
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
  const [boundaryLen, setBoundaryLen] = useState('');
  const [boundaryRate, setBoundaryRate] = useState(DEFAULT_BOUNDARY_RATE);
  const [extraRows, setExtraRows] = useState<{ kind: LayoutExtraKind; name: string; area: string }[]>([]);
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [docKind, setDocKind] = useState<ProjectDocumentKind>('ARCHITECTURAL');
  const [docTitle, setDocTitle] = useState('');
  const [docVisible, setDocVisible] = useState(true);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  const [readMsg, setReadMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function load(f: ProjectForecast) {
    setFc(f);
    if (f.layout) {
      setFloors(f.layout.floors.map((x) => ({ name: x.name, area: String(x.area_sqft), drawing: x.drawing_area_sqft != null ? String(x.drawing_area_sqft) : '', allowed: x.allowed_area_sqft != null ? String(x.allowed_area_sqft) : '' })));
      setFinish(f.layout.finish_level);
      setFactors(Object.fromEntries(Object.entries(f.layout.price_factors).map(([k, v]) => [k, String(v)])));
      setNote(f.layout.source_note ?? '');
      setProgress(Object.fromEntries(Object.entries(f.layout.progress ?? {}).map(([k, v]) => [k, String(v)])));
      const bw = f.layout.extras?.boundary_wall;
      setBoundaryLen(bw ? String(bw.length_ft) : '');
      setBoundaryRate(bw ? String(bw.rate_per_ft) : DEFAULT_BOUNDARY_RATE);
      setExtraRows((f.layout.extras?.items ?? []).map((i) => ({ kind: i.kind, name: i.name, area: String(i.area_sqft) })));
    }
  }

  function reloadDocs() {
    listAdminProjectDocuments(projectId).then(setDocs).catch(() => undefined);
  }

  useEffect(() => {
    reloadDocs();
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

  function buildExtras() {
    const items = extraRows
      .filter((r) => r.name.trim() && Number(r.area) > 0)
      .map((r) => ({ kind: r.kind, name: r.name.trim(), area_sqft: Number(r.area) }));
    const len = Number(boundaryLen);
    const rate = Number(boundaryRate);
    if (items.length === 0 && !(len > 0)) return null;
    return { boundary_wall: len > 0 && rate > 0 ? { length_ft: len, rate_per_ft: rate } : null, items };
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setDocBusy('upload');
    setErr(null);
    try {
      await uploadProjectDocument(projectId, file, { kind: docKind, title: docTitle.trim() || file.name, visible_to_owner: docVisible });
      setDocTitle('');
      reloadDocs();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setDocBusy(null);
    }
  }

  async function onRead(d: ProjectDocument) {
    setDocBusy(d.id);
    setErr(null);
    setReadMsg(null);
    try {
      const x = await extractLayoutFromDocument(projectId, d.id);
      if (x.floors.length > 0) {
        setFloors(
          x.floors.map((f) => ({
            name: f.name,
            area: f.covered_area_sqft ? String(f.covered_area_sqft) : '',
            drawing: f.covered_area_sqft ? String(f.covered_area_sqft) : '',
            allowed: f.allowable_area_sqft ? String(f.allowable_area_sqft) : '',
          })),
        );
      }
      if (x.boundary_wall_length_ft) setBoundaryLen(String(x.boundary_wall_length_ft));
      if (x.extras.length > 0) {
        setExtraRows(x.extras.map((e) => ({ kind: e.kind, name: e.name, area: e.area_sqft ? String(e.area_sqft) : '' })));
      }
      setReadMsg(
        'Read from the drawing. Check every number against the drawing, then Save & forecast and Confirm.' +
          (x.boundary_wall_inferred ? ' Boundary wall length was worked out from the plot size.' : '') +
          (x.notes ? ` Reader note: ${x.notes}` : ''),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read the drawing');
    } finally {
      setDocBusy(null);
    }
  }

  async function onToggle(d: ProjectDocument) {
    setDocBusy(d.id);
    try {
      await setProjectDocumentVisibility(projectId, d.id, !d.visible_to_owner);
      reloadDocs();
    } finally {
      setDocBusy(null);
    }
  }

  async function onDelete(d: ProjectDocument) {
    if (!window.confirm(`Delete "${d.title}"?`)) return;
    setDocBusy(d.id);
    try {
      await deleteProjectDocument(projectId, d.id);
      reloadDocs();
    } finally {
      setDocBusy(null);
    }
  }

  function saveProgress() {
    const p: Partial<Record<ForecastGroupKey, number>> = {};
    for (const g of FACTOR_GROUPS) {
      const raw = progress[g.key];
      if (raw === undefined || raw === '') continue;
      const v = Number(raw);
      if (!(v >= 0 && v <= 100)) return setErr(`${g.label}: percent complete must be between 0 and 100`);
      p[g.key] = v;
    }
    run(() => saveProjectProgress(projectId, p));
  }

  function save() {
    const rows = floors.filter((f) => f.name.trim() && Number(f.area) > 0).map((f) => ({ name: f.name.trim(), area_sqft: Number(f.area), drawing_area_sqft: Number(f.drawing) > 0 ? Number(f.drawing) : null, allowed_area_sqft: Number(f.allowed) > 0 ? Number(f.allowed) : null }));
    if (rows.length === 0) return setErr('Enter the covered area for at least one floor');
    const pf: Partial<Record<ForecastGroupKey, number>> = {};
    for (const g of FACTOR_GROUPS) {
      const v = Number(factors[g.key]);
      if (factors[g.key] && v > 0 && v !== 1) pf[g.key] = v;
    }
    run(() => saveProjectLayout(projectId, { floors: rows, finish_level: finish, price_factors: Object.keys(pf).length ? pf : null, source_note: note || null, extras: buildExtras() }));
  }

  const confirmed = fc?.layout?.status === 'CONFIRMED';

  return (
    <section style={box}>
      <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>Layout &amp; cost forecast</h2>
      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 12px' }}>
        Enter the covered area per floor from the architect&apos;s drawings. Areas stay unconfirmed until you confirm them.
      </p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', marginBottom: '14px' }}>
        <strong style={{ fontSize: '13px' }}>Drawings &amp; reports</strong>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0', alignItems: 'center' }}>
          <select style={input} value={docKind} onChange={(e) => setDocKind(e.target.value as ProjectDocumentKind)}>
            {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input style={{ ...input, flex: 1, minWidth: '140px' }} placeholder="Title (optional)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          <label style={{ fontSize: '12px' }}><input type="checkbox" checked={docVisible} onChange={(e) => setDocVisible(e.target.checked)} /> Show to owner</label>
          <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={docBusy === 'upload'} onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          {docBusy === 'upload' && <span style={{ fontSize: '12px' }}>Uploading…</span>}
        </div>
        {docs.length === 0 && <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>No files attached yet (PDF, PNG or JPEG, up to 30 MB).</p>}
        {docs.map((d) => (
          <div key={d.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', padding: '4px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: '160px' }}>
              {d.download_url ? <a href={d.download_url} target="_blank" rel="noreferrer">{d.title}</a> : d.title}
              <span style={{ color: 'var(--muted)' }}> · {DOC_KINDS.find((k) => k.value === d.kind)?.label} · {(d.size_bytes / 1048576).toFixed(1)} MB</span>
            </span>
            <button type="button" style={{ ...input, cursor: 'pointer' }} disabled={docBusy === d.id} onClick={() => onToggle(d)}>
              {d.visible_to_owner ? 'Visible to owner' : 'Hidden from owner'}
            </button>
            {d.kind === 'ARCHITECTURAL' && d.content_type === 'application/pdf' && (
              <button type="button" style={{ ...input, cursor: 'pointer' }} disabled={docBusy === d.id} onClick={() => onRead(d)}>
                {docBusy === d.id ? 'Reading… (up to 2 min)' : 'Read areas from drawing'}
              </button>
            )}
            <button type="button" style={{ ...input, cursor: 'pointer', color: 'var(--error)' }} disabled={docBusy === d.id} onClick={() => onDelete(d)}>Delete</button>
          </div>
        ))}
        {readMsg && <p style={{ fontSize: '12px', color: '#b45309', margin: '8px 0 0' }}>{readMsg}</p>}
      </div>

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

      <div style={{ marginBottom: '12px' }}>
        <strong style={{ fontSize: '13px' }}>Extras that add cost</strong>
        <div style={{ display: 'flex', gap: '8px', margin: '6px 0', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', width: '110px' }}>Boundary wall</span>
          <input style={{ ...input, width: '110px' }} inputMode="decimal" placeholder="length (ft)" value={boundaryLen} onChange={(e) => setBoundaryLen(e.target.value)} />
          <input style={{ ...input, width: '110px' }} inputMode="decimal" placeholder="Rs per ft" value={boundaryRate} onChange={(e) => setBoundaryRate(e.target.value)} />
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>rate is an assumption, replace with your quote</span>
        </div>
        {extraRows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <select style={input} value={r.kind} onChange={(e) => setExtraRows(extraRows.map((x, j) => (j === i ? { ...x, kind: e.target.value as LayoutExtraKind } : x)))}>
              {EXTRA_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input style={{ ...input, flex: 1 }} placeholder="name" value={r.name} onChange={(e) => setExtraRows(extraRows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input style={{ ...input, width: '110px' }} inputMode="decimal" placeholder="sq ft" value={r.area} onChange={(e) => setExtraRows(extraRows.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} />
            <button type="button" style={{ ...input, cursor: 'pointer' }} onClick={() => setExtraRows(extraRows.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" style={{ ...input, cursor: 'pointer' }} onClick={() => setExtraRows([...extraRows, { kind: 'BALCONY', name: '', area: '' }])}>+ Add shade / balcony</button>
      </div>

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
          {fc.rate_observations.length > 0 && (
            <p style={{ fontSize: '12px', margin: '4px 0' }}>
              Live rates from your purchases:{' '}
              {fc.rate_observations.map((o) => `${o.label} Rs ${o.actual_rate.toLocaleString()}/${o.unit} (reference ${o.reference_rate.toLocaleString()}, ${o.ratio >= 1 ? '+' : ''}${Math.round((o.ratio - 1) * 100)}%)`).join(' · ')}
              {fc.structure_index_applied ? '' : ' — not applied because a manual Structure factor is set'}
            </p>
          )}
          {fc.extras.length > 0 && (
            <p style={{ fontSize: '12px', margin: '4px 0' }}>
              Included extras: {fc.extras.map((e) => `${e.name} (${e.quantity.toLocaleString()} ${e.unit}) ${pkr(e.cost)}`).join(' · ')}
            </p>
          )}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', margin: '10px 0' }}>
            <strong style={{ fontSize: '13px' }}>Percent complete (drives the forecast)</strong>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '8px 0', alignItems: 'flex-end' }}>
              {FACTOR_GROUPS.map((g) => (
                <label key={g.key} style={{ fontSize: '12px' }}>{g.label} %<br />
                  <input style={{ ...input, width: '70px' }} inputMode="decimal" placeholder="0" value={progress[g.key] ?? ''} onChange={(e) => setProgress({ ...progress, [g.key]: e.target.value })} />
                </label>
              ))}
              <button type="button" style={btn} disabled={busy} onClick={saveProgress}>Save progress</button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
              Final cost of a group is projected as spent ÷ percent complete, blended with the area estimate. Saving progress does not reset the confirmation.
            </p>
          </div>
          {fc.notes.map((n) => (
            <p key={n} style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0' }}>{n}</p>
          ))}
        </>
      )}
    </section>
  );
}
