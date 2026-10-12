'use client';

import { useRef, useState } from 'react';
import { uploadFileToPresignedUrl, type PhotoUploadUrl } from '@/lib/api';

export interface PickedPhoto {
  key: string;
  preview: string; // local object URL
}

const MAX_SIDE = 1800;

// Phone photos are often 5-10 MB. Shrink to a sensible size in the browser so
// uploads are fast on mobile data and stay well under the server limit.
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (blob && blob.size > 0 && (blob.size < file.size || file.type === 'image/heic')) {
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
  } catch {
    /* fall back to the original file */
  }
  return file;
}

// Choose up to `max` photos; each is uploaded straight to storage as soon as
// it is picked. Reports the storage keys, which the form submits.
export function PortfolioPhotoPicker({
  max = 8,
  requestUrl,
  photos,
  onChange,
  addLabel = '+ Add photos',
}: {
  max?: number;
  requestUrl: (contentType: string) => Promise<PhotoUploadUrl>;
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  addLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // The latest list, so several files finishing at different times don't overwrite each other.
  const latest = useRef(photos);
  latest.current = photos;

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    const room = max - latest.current.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setError(`You can add up to ${max} photos.`);
    for (const original of chosen) {
      setBusy((n) => n + 1);
      try {
        if (!original.type.startsWith('image/')) throw new Error('Only photos can be added.');
        const file = await shrink(original);
        const { key, upload_url, max_bytes } = await requestUrl(file.type);
        if (file.size > max_bytes) throw new Error('A photo is too large.');
        await uploadFileToPresignedUrl(upload_url, file);
        const next = [...latest.current, { key, preview: URL.createObjectURL(file) }];
        latest.current = next;
        onChange(next);
      } catch (e) {
        setError(e instanceof Error ? e.message.replace(/^API error \d+: /, '') : 'A photo could not be uploaded.');
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
        {photos.map((p) => (
          <div key={p.key} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(photos.filter((x) => x.key !== p.key))}
              style={{ position: 'absolute', top: '4px', right: '4px', width: '26px', height: '26px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: '15px', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
        {busy > 0 && (
          <div style={{ aspectRatio: '1', borderRadius: '8px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--muted)' }}>
            Uploading…
          </div>
        )}
      </div>
      {photos.length < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy > 0}
          style={{ alignSelf: 'flex-start', padding: '10px 16px', background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 700, cursor: busy > 0 ? 'wait' : 'pointer' }}
        >
          {addLabel}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {error && <p style={{ margin: 0, fontSize: '13px', color: 'var(--error)' }}>{error}</p>}
    </div>
  );
}
