'use client';

import { useState, type FormEvent } from 'react';
import type { PhotoUploadUrl, ProjectFieldsInput } from '@/lib/api';
import { PortfolioPhotoPicker, type PickedPhoto } from '@/components/PortfolioPhotoPicker';

const input: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '15px', background: '#fff', width: '100%' };
const label: React.CSSProperties = { fontSize: '13px', fontWeight: 700 };
const group: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' };

// Shared by the admin page and the contractor's own upload page. `bilingual`
// adds an Urdu line under each label for contractors who prefer Urdu.
export function ProjectForm({
  requestUrl,
  onSubmit,
  requirePhoto,
  bilingual = false,
  submitLabel = 'Save project',
}: {
  requestUrl: (contentType: string) => Promise<PhotoUploadUrl>;
  onSubmit: (data: ProjectFieldsInput) => Promise<void>;
  requirePhoto: boolean;
  bilingual?: boolean;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState('');
  const [society, setSociety] = useState('');
  const [city, setCity] = useState('');
  const [plot, setPlot] = useState('');
  const [year, setYear] = useState('');
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ur = (t: string) => bilingual && <span lang="ur" dir="rtl" style={{ display: 'block', fontWeight: 500, color: 'var(--muted)', fontSize: '13px' }}>{t}</span>;
  const ok = title.trim().length >= 2 && (!requirePhoto || photos.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        society_name: society.trim() || null,
        city: city.trim() || null,
        plot_size: plot.trim() || null,
        completed_year: year ? Number(year) : null,
        description: desc.trim() || null,
        photo_keys: photos.map((p) => p.key),
      });
      setTitle(''); setSociety(''); setCity(''); setPlot(''); setYear(''); setDesc(''); setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^API error \d+: /, '') : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={group}>
        <label style={label}>Project name {ur('پراجیکٹ کا نام')}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10 marla house, Block C" maxLength={150} style={input} />
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ ...group, flex: '1 1 200px' }}>
          <label style={label}>Society {ur('سوسائٹی')}</label>
          <input value={society} onChange={(e) => setSociety(e.target.value)} placeholder="e.g. Faisal Hills" maxLength={150} style={input} />
        </div>
        <div style={{ ...group, flex: '1 1 140px' }}>
          <label style={label}>City {ur('شہر')}</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Islamabad" maxLength={100} style={input} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ ...group, flex: '1 1 140px' }}>
          <label style={label}>Plot size {ur('پلاٹ کا سائز')}</label>
          <input value={plot} onChange={(e) => setPlot(e.target.value)} placeholder="e.g. 10 marla" maxLength={50} style={input} />
        </div>
        <div style={{ ...group, flex: '1 1 140px' }}>
          <label style={label}>Year completed {ur('مکمل ہونے کا سال')}</label>
          <input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="e.g. 2024" style={input} />
        </div>
      </div>
      <div style={group}>
        <label style={label}>What you built (optional) {ur('کیا بنایا (اختیاری)')}</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Grey structure and finishing, 2 floors" style={{ ...input, resize: 'vertical' }} />
      </div>
      <div style={group}>
        <label style={label}>
          Photos {requirePhoto ? '(at least 1)' : ''} {ur('تصاویر')}
        </label>
        <PortfolioPhotoPicker requestUrl={requestUrl} photos={photos} onChange={setPhotos} addLabel={bilingual ? '+ Add photos / تصاویر شامل کریں' : '+ Add photos'} />
      </div>
      {error && <p style={{ margin: 0, color: 'var(--error)', fontSize: '13px' }}>{error}</p>}
      <button type="submit" disabled={busy || !ok} style={{ alignSelf: 'flex-start', padding: '12px 22px', background: busy || !ok ? 'var(--muted)' : '#111', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '15px', fontWeight: 700, cursor: busy || !ok ? 'not-allowed' : 'pointer' }}>
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
