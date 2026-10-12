'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { fetchAdminSociety, updateSociety, type AdminSociety } from '@/lib/api';
import { CANONICAL_CITY_OPTIONS, PROPERTY_TYPE_OPTIONS, fieldGroupStyle, inputStyle, labelStyle } from '../../../constants';

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const str = (v: number | string | null) => (v === null || v === undefined ? '' : String(Number(v)));

export default function EditSocietyPage() {
  const societyId = useParams().id as string;
  const [loaded, setLoaded] = useState<AdminSociety | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [noc, setNoc] = useState(false);
  const [nocSummary, setNocSummary] = useState('');
  const [developerId, setDeveloperId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function apply(s: AdminSociety) {
    setLoaded(s);
    setName(s.name);
    setCity(s.city);
    setMinPrice(str(s.min_price));
    setMaxPrice(str(s.max_price));
    setMinArea(str(s.min_area_marla));
    setMaxArea(str(s.max_area_marla));
    setTypes(s.property_types);
    setNoc(s.noc_approved);
    setNocSummary(s.noc_summary ?? '');
    setDeveloperId(s.developer_id ?? '');
  }

  useEffect(() => {
    fetchAdminSociety(societyId).then(apply).catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load society'));
  }, [societyId]);

  const devOk = !developerId.trim() || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(developerId.trim());
  const canSave = name.trim() && city.trim() && types.length > 0 && devOk && !saving;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await updateSociety(societyId, {
        name: name.trim(),
        city: city.trim(),
        min_price: numOrNull(minPrice),
        max_price: numOrNull(maxPrice),
        min_area_marla: numOrNull(minArea),
        max_area_marla: numOrNull(maxArea),
        property_types: types,
        noc_approved: noc,
        noc_summary: nocSummary.trim() || null,
        developer_id: developerId.trim() || null,
      });
      apply(res);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <article style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Link href="/admin/societies" style={{ fontSize: '14px', color: 'var(--muted)' }}>← All societies</Link>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADMIN — INTERNAL ONLY</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Edit society</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
            Every change is logged. Confidence and affiliation can&apos;t be changed here. Claims and documents are managed under{' '}
            <Link href={`/admin/society/${societyId}/add-claim`} style={{ fontWeight: 600 }}>Claims &amp; evidence</Link>.
          </p>
        </div>

        {loadError && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{loadError}</p>}
        {!loaded && !loadError && <Spinner />}

        {loaded && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} required list="edit-city-options" style={inputStyle} />
              <datalist id="edit-city-options">
                {CANONICAL_CITY_OPTIONS.map((c) => (<option key={c} value={c} />))}
              </datalist>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ ...fieldGroupStyle, flex: 1 }}>
                <label style={labelStyle}>Min price (PKR)</label>
                <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ ...fieldGroupStyle, flex: 1 }}>
                <label style={labelStyle}>Max price (PKR)</label>
                <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ ...fieldGroupStyle, flex: 1 }}>
                <label style={labelStyle}>Min area (marla)</label>
                <input type="number" value={minArea} onChange={(e) => setMinArea(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ ...fieldGroupStyle, flex: 1 }}>
                <label style={labelStyle}>Max area (marla)</label>
                <input type="number" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Property types</label>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {PROPERTY_TYPE_OPTIONS.map((t) => (
                  <label key={t} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="checkbox"
                      checked={types.includes(t)}
                      onChange={() => setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={noc} onChange={(e) => setNoc(e.target.checked)} />
              NOC approved
            </label>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>NOC summary</label>
              <textarea value={nocSummary} onChange={(e) => setNocSummary(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Developer ID (optional)</label>
              <input value={developerId} onChange={(e) => setDeveloperId(e.target.value)} placeholder="Developer UUID, blank to unlink" style={inputStyle} />
              {!devOk && <p style={{ fontSize: '12px', color: 'var(--error)' }}>Must be a valid UUID.</p>}
            </div>

            {error && (
              <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '13px' }}>
                {error}
              </div>
            )}
            {saved && (
              <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)', color: '#166534', fontSize: '13px', fontWeight: 600 }}>
                Saved. <Link href={`/society/${societyId}`}>View society profile →</Link>
              </div>
            )}
            <button
              type="submit"
              disabled={!canSave}
              style={{ padding: '12px 20px', background: canSave ? '#111' : 'var(--muted)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}
      </article>
    </main>
  );
}
