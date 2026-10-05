'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { HousePlanImage, HousePlanImageType, HousePlanAccessTier } from '@/lib/api';
import {
  fetchAdminHousePlanImages,
  createHousePlanImage,
  uploadHousePlanImageFile,
  updateHousePlanImage,
  deleteHousePlanImage,
} from '@/lib/api';
import { HOUSE_PLAN_IMAGE_TYPE_OPTIONS } from '@/lib/housePlanImageTypes';
import { fieldGroupStyle, inputStyle, labelStyle } from '@/app/admin/constants';

// Same base64-encode approach as admin/new-house-plan/page.tsx's fileToBase64
// — no multipart plugin on this Fastify backend.
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// HOUSE PLAN GALLERY (admin) — expand-row panel, same embedding convention as
// EditRow in admin/house-plans/page.tsx. Manages the elevation/3D-render set
// for one plan: add a tagged image (type + tier + price), attach its file,
// edit tier/price, delete. Tiering (FREE/GATED + price) is live now even
// though the unlock flow isn't built yet — gated uploads just show as locked
// placeholders on the public page until that exists.
export function HousePlanAdminGallery({ housePlanId }: { housePlanId: string }) {
  const [images, setImages] = useState<HousePlanImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newType, setNewType] = useState<HousePlanImageType>(HOUSE_PLAN_IMAGE_TYPE_OPTIONS[0].value);
  const [newTier, setNewTier] = useState<HousePlanAccessTier>('FREE');
  const [newPrice, setNewPrice] = useState('0');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchAdminHousePlanImages(housePlanId)
      .then((res) => setImages(res.images))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load gallery'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [housePlanId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const created = await createHousePlanImage(housePlanId, {
        image_type: newType,
        access_tier: newTier,
        price: Number(newPrice) || 0,
      });
      if (newFile) {
        const data_base64 = await fileToBase64(newFile);
        await uploadHousePlanImageFile(housePlanId, created.id, {
          filename: newFile.name,
          content_type: newFile.type || 'application/octet-stream',
          data_base64,
        });
      }
      setNewFile(null);
      setNewPrice('0');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add image');
    } finally {
      setAdding(false);
    }
  }

  async function handleTierChange(img: HousePlanImage, access_tier: HousePlanAccessTier) {
    setBusyId(img.id);
    try {
      const updated = await updateHousePlanImage(housePlanId, img.id, { access_tier });
      setImages((prev) => prev.map((i) => (i.id === img.id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image');
    } finally {
      setBusyId(null);
    }
  }

  async function handlePriceChange(img: HousePlanImage, price: number) {
    setBusyId(img.id);
    try {
      const updated = await updateHousePlanImage(housePlanId, img.id, { price });
      setImages((prev) => prev.map((i) => (i.id === img.id ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(img: HousePlanImage) {
    if (!window.confirm('Delete this image?')) return;
    setBusyId(img.id);
    try {
      await deleteHousePlanImage(housePlanId, img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {error && <p style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>}

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading gallery…</p>
      ) : images.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No gallery images yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {images.map((img) => (
            <div
              key={img.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '110px' }}>
                {HOUSE_PLAN_IMAGE_TYPE_OPTIONS.find((o) => o.value === img.image_type)?.label}
              </span>
              <span style={{ fontSize: '12px', color: img.has_file ? 'var(--text)' : 'var(--muted)' }}>
                {img.has_file
                  ? img.content_type === 'application/pdf'
                    ? 'PDF uploaded'
                    : 'Image uploaded'
                  : 'No file yet'}
              </span>
              <select
                value={img.access_tier}
                onChange={(e) => handleTierChange(img, e.target.value as HousePlanAccessTier)}
                disabled={busyId === img.id}
                style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              >
                <option value="FREE">Free</option>
                <option value="GATED">Gated</option>
              </select>
              <input
                type="number"
                min="0"
                step="1"
                defaultValue={img.price}
                onBlur={(e) => {
                  const price = Number(e.target.value) || 0;
                  if (price !== img.price) handlePriceChange(img, price);
                }}
                disabled={busyId === img.id}
                style={{ ...inputStyle, width: '90px', padding: '4px 8px', fontSize: '12px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>PKR</span>
              <button
                type="button"
                onClick={() => handleDelete(img)}
                disabled={busyId === img.id}
                style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius)',
                  background: '#fff',
                  color: 'var(--error)',
                  cursor: busyId === img.id ? 'not-allowed' : 'pointer',
                }}
              >
                {busyId === img.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          padding: '10px',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ ...fieldGroupStyle, minWidth: '140px' }}>
          <label style={labelStyle}>Type</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as HousePlanImageType)}
            style={{ ...inputStyle, fontSize: '13px' }}
          >
            {HOUSE_PLAN_IMAGE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ ...fieldGroupStyle, minWidth: '100px' }}>
          <label style={labelStyle}>Access</label>
          <select
            value={newTier}
            onChange={(e) => setNewTier(e.target.value as HousePlanAccessTier)}
            style={{ ...inputStyle, fontSize: '13px' }}
          >
            <option value="FREE">Free</option>
            <option value="GATED">Gated</option>
          </select>
        </div>
        <div style={{ ...fieldGroupStyle, minWidth: '90px' }}>
          <label style={labelStyle}>Price (PKR)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            style={{ ...inputStyle, fontSize: '13px' }}
          />
        </div>
        <div style={{ ...fieldGroupStyle, minWidth: '180px' }}>
          <label style={labelStyle}>File (optional)</label>
          {/* 3D renders are often delivered as a multi-page PDF walkthrough
              rather than a single image, so this accepts both. */}
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          style={{
            padding: '8px 16px',
            background: adding ? 'var(--muted)' : '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: adding ? 'not-allowed' : 'pointer',
          }}
        >
          {adding ? 'Adding…' : '+ Add image'}
        </button>
      </form>
    </div>
  );
}
