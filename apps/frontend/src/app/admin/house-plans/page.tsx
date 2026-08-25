'use client';

import { Fragment, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import type { HousePlanStyle, HousePlanSummary } from '@siraat/shared-types';
import { fetchAdminHousePlans, updateHousePlan, deleteHousePlan } from '@/lib/api';
import { HOUSE_PLAN_STYLE_OPTIONS } from '@/lib/housePlanStyles';
import { HousePlanImage } from '@/components/HousePlanImage';
import { AdminNav } from '../AdminNav';
import { fieldGroupStyle, inputStyle, labelStyle } from '../constants';

const PAGE_SIZE = 20;

function styleLabel(value: string): string {
  return HOUSE_PLAN_STYLE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

type EditDraft = Pick<
  HousePlanSummary,
  'title' | 'area_marla' | 'bedrooms' | 'style' | 'description' | 'contact_whatsapp' | 'is_siraat_affiliated'
>;

// ADMIN CRUD PHASE 1 Chunk 2 — expand-row edit form, not inline table cells:
// HousePlan has more editable fields (7) than CandidateSociety (4), including
// a multi-line description, so cramming them into table cells would force the
// table too wide. This renders as a second <tr> (colSpan across every
// column) directly under the row being edited instead.
function EditRow({
  columnCount,
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  columnCount: number;
  draft: EditDraft;
  onChange: (next: EditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave();
  }

  return (
    <tr style={{ borderTop: '1px solid var(--border)', background: '#f9fafb' }}>
      <td colSpan={columnCount} style={{ padding: '16px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ ...fieldGroupStyle, flex: 2, minWidth: '200px' }}>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => onChange({ ...draft, title: e.target.value })}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '100px' }}>
              <label style={labelStyle}>Area (Marla)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.area_marla}
                onChange={(e) => onChange({ ...draft, area_marla: Number(e.target.value) })}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '100px' }}>
              <label style={labelStyle}>Bedrooms</label>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.bedrooms}
                onChange={(e) => onChange({ ...draft, bedrooms: Number(e.target.value) })}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>Style</label>
              <select
                value={draft.style}
                onChange={(e) => onChange({ ...draft, style: e.target.value as HousePlanStyle })}
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
              value={draft.description}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
              rows={3}
              required
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ ...fieldGroupStyle, flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Contact WhatsApp</label>
              <input
                type="text"
                value={draft.contact_whatsapp}
                onChange={(e) => onChange({ ...draft, contact_whatsapp: e.target.value })}
                required
                style={inputStyle}
              />
            </div>
            <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '10px' }}>
              <input
                type="checkbox"
                checked={draft.is_siraat_affiliated}
                onChange={(e) => onChange({ ...draft, is_siraat_affiliated: e.target.checked })}
              />
              Siraat-affiliated
            </label>
          </div>

          {error && <p style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={saving} style={primaryButtonStyle(saving)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onCancel} disabled={saving} style={plainButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

export default function AdminHousePlansPage() {
  const [plans, setPlans] = useState<HousePlanSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  function loadPlans() {
    setLoading(true);
    setError(null);
    fetchAdminHousePlans({ page, limit: PAGE_SIZE })
      .then((data) => {
        setPlans(data.house_plans);
        setTotalCount(data.total_count);
        setTotalPages(data.total_pages);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function startEdit(p: HousePlanSummary) {
    setEditingId(p.id);
    setEditDraft({
      title: p.title,
      area_marla: p.area_marla,
      bedrooms: p.bedrooms,
      style: p.style,
      description: p.description,
      contact_whatsapp: p.contact_whatsapp,
      is_siraat_affiliated: p.is_siraat_affiliated,
    });
    setRowError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    setSavingId(id);
    setRowError(null);
    try {
      const updated = await updateHousePlan(id, editDraft);
      setPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      setRowError({ id, message: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(p: HousePlanSummary) {
    if (!window.confirm(`Delete house plan "${p.title}"? This cannot be undone.`)) return;
    setDeletingId(p.id);
    setRowError(null);
    try {
      await deleteHousePlan(p.id);
      setPlans((prev) => prev.filter((x) => x.id !== p.id));
      setTotalCount((c) => Math.max(0, c - 1));
      if (editingId === p.id) cancelEdit();
    } catch (err) {
      setRowError({ id: p.id, message: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeletingId(null);
    }
  }

  const COLUMN_COUNT = 6;

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AdminNav active="house-plans" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
              ADMIN — INTERNAL ONLY
            </p>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>House Plans</h1>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
              {loading ? 'Loading…' : `${totalCount} plan${totalCount === 1 ? '' : 's'} in the catalog`}
            </p>
          </div>
          <Link
            href="/admin/new-house-plan"
            style={{
              padding: '10px 16px',
              background: '#111',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            + Add New
          </Link>
        </div>

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

        {loading ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
        ) : plans.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            No house plans yet. <Link href="/admin/new-house-plan">Add the first one →</Link>
          </p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ ...thStyle, width: '64px' }}></th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Area</th>
                  <th style={thStyle}>Bedrooms</th>
                  <th style={thStyle}>Style</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <Fragment key={p.id}>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ width: '48px' }}>
                          <HousePlanImage housePlanId={p.id} hasImage={Boolean(p.preview_image_ref)} alt={p.title} aspectRatio="1 / 1" />
                        </div>
                      </td>
                      <td style={tdStyle}>{p.title}</td>
                      <td style={tdStyle}>{p.area_marla} Marla</td>
                      <td style={tdStyle}>{p.bedrooms}</td>
                      <td style={tdStyle}>{styleLabel(p.style)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => (editingId === p.id ? cancelEdit() : startEdit(p))} style={plainButtonStyle}>
                            {editingId === p.id ? 'Close' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            disabled={deletingId === p.id}
                            style={dangerButtonStyle(deletingId === p.id)}
                          >
                            {deletingId === p.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                        {rowError?.id === p.id && !editingId && (
                          <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '6px' }}>{rowError.message}</p>
                        )}
                      </td>
                    </tr>
                    {editingId === p.id && editDraft && (
                      <EditRow
                        key={`${p.id}-edit`}
                        columnCount={COLUMN_COUNT}
                        draft={editDraft}
                        onChange={setEditDraft}
                        onSave={() => saveEdit(p.id)}
                        onCancel={cancelEdit}
                        saving={savingId === p.id}
                        error={rowError?.id === p.id ? rowError.message : null}
                      />
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} style={paginationButtonStyle(page <= 1)}>
              ← Prev
            </button>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              style={paginationButtonStyle(page >= totalPages)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

const thStyle: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: '12px' };
const tdStyle: CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };

const plainButtonStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  cursor: 'pointer',
};

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: 600,
    padding: '8px 16px',
    border: 'none',
    borderRadius: 'var(--radius)',
    background: disabled ? 'var(--muted)' : '#111',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    alignSelf: 'flex-start',
  };
}

function dangerButtonStyle(disabled: boolean): CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: 600,
    padding: '6px 12px',
    border: '1px solid var(--error)',
    borderRadius: 'var(--radius)',
    background: '#fff',
    color: 'var(--error)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function paginationButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: disabled ? '#f3f4f6' : '#fff',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
