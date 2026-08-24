'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import type { HousePlanStyle } from '@siraat/shared-types';
import { createHousePlan, uploadHousePlanImage } from '@/lib/api';
import { HOUSE_PLAN_STYLE_OPTIONS } from '@/lib/housePlanStyles';
import { AdminNav } from '../AdminNav';
import { fieldGroupStyle, inputStyle, labelStyle } from '../constants';

// Base64-encodes a File client-side for the upload-image endpoint's JSON
// body (see uploadHousePlanImage in lib/api.ts) — readAsDataURL's result is
// "data:<mime>;base64,<data>", so only the part after the first comma is kept.
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

export default function NewHousePlanPage() {
  const [title, setTitle] = useState('');
  const [areaMarla, setAreaMarla] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [style, setStyle] = useState<HousePlanStyle>(HOUSE_PLAN_STYLE_OPTIONS[0].value);
  const [description, setDescription] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [isAffiliated, setIsAffiliated] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ house_plan_id: string; imageUploadError: string | null } | null>(
    null,
  );

  const canSubmit =
    title.trim().length > 0 &&
    Number(areaMarla) > 0 &&
    bedrooms.trim().length > 0 &&
    Number(bedrooms) >= 0 &&
    description.trim().length > 0 &&
    contactWhatsapp.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const plan = await createHousePlan({
        title: title.trim(),
        area_marla: Number(areaMarla),
        bedrooms: Number(bedrooms),
        style,
        description: description.trim(),
        contact_whatsapp: contactWhatsapp.trim(),
        is_siraat_affiliated: isAffiliated,
      });

      // Image upload is a second call against the now-known plan id (see
      // CreateHousePlanBodySchema's comment in admin.controller.ts) — its
      // failure shouldn't undo the plan that was just created, so it's caught
      // and surfaced separately rather than failing the whole submission.
      let imageUploadError: string | null = null;
      if (imageFile) {
        try {
          const data_base64 = await fileToBase64(imageFile);
          await uploadHousePlanImage(plan.id, {
            filename: imageFile.name,
            content_type: imageFile.type || 'application/octet-stream',
            data_base64,
          });
        } catch (uploadErr) {
          imageUploadError = uploadErr instanceof Error ? uploadErr.message : 'Image upload failed';
        }
      }

      setResult({ house_plan_id: plan.id, imageUploadError });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 32px',
        gap: '28px',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <AdminNav active="house-plans" />
      </div>

      <article style={{ maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Add House Plan</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Adds one plan to the House Plans catalog. Directory only — no payment, no
            full-resolution download.
          </p>
        </div>

        {result ? (
          <div
            style={{
              padding: '20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius)',
              color: '#166534',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            House plan created
            <p style={{ fontSize: '13px', fontWeight: 400, color: '#166534' }}>
              House Plan ID: {result.house_plan_id}
            </p>
            {result.imageUploadError && (
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--error)' }}>
                Image upload failed: {result.imageUploadError}. The plan was created without a
                preview image — try again from the catalog later.
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', fontWeight: 600 }}>
              <Link href={`/house-plan/${result.house_plan_id}`} style={{ fontSize: '13px' }}>
                View public page →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>House Plan</legend>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='e.g. "5 Marla Modern Home"'
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Area (Marla)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={areaMarla}
                    onChange={(e) => setAreaMarla(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Bedrooms</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value as HousePlanStyle)}
                    style={inputStyle}
                  >
                    {HOUSE_PLAN_STYLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                  style={{ ...inputStyle, resize: 'vertical' as const }}
                />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Contact WhatsApp</label>
                <input
                  type="text"
                  value={contactWhatsapp}
                  onChange={(e) => setContactWhatsapp(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Preview image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={isAffiliated} onChange={(e) => setIsAffiliated(e.target.checked)} />
                Siraat-affiliated
              </label>
            </fieldset>

            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius)',
                  color: 'var(--error)',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              style={{
                padding: '12px 20px',
                background: submitting || !canSubmit ? 'var(--muted)' : '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Creating…' : 'Create house plan'}
            </button>
          </form>
        )}
      </article>
    </main>
  );
}

const fieldsetStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const legendStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--muted)',
  padding: '0 6px',
};
