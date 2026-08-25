'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  fetchCandidateSocieties,
  updateCandidateSociety,
  deleteCandidateSociety,
  type CandidateSociety,
} from '@/lib/api';
import { AdminNav } from '../AdminNav';

type StatusFilter = 'ALL' | CandidateSociety['status'];
type SortKey = 'regulator' | 'city';

const STATUS_OPTIONS: StatusFilter[] = ['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'ONBOARDED'];

// ADMIN CRUD PHASE 1 Chunk 2 — edit-form option lists, no 'ALL' entry (that's
// filter-only, above).
const REGULATOR_OPTIONS: CandidateSociety['regulator'][] = ['CDA', 'RDA', 'TMA', 'OTHER'];
const EDIT_STATUS_OPTIONS: CandidateSociety['status'][] = ['NOT_STARTED', 'IN_PROGRESS', 'ONBOARDED'];

type EditDraft = Pick<CandidateSociety, 'name' | 'regulator' | 'city' | 'status'>;

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateSociety[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ADMIN CRUD PHASE 1 Chunk 2 — inline edit state: only one row editable at
  // a time, keyed by candidate id. rowError is per-row (save/delete failures
  // shouldn't blank out the whole page's data), distinct from the page-level
  // `error` above (initial load failures).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCandidateSocieties(statusFilter === 'ALL' ? undefined : statusFilter)
      .then((data) => {
        if (!cancelled) setCandidates(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const sorted = useMemo(() => {
    const copy = [...candidates];
    copy.sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [candidates, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function startEdit(c: CandidateSociety) {
    setEditingId(c.id);
    setEditDraft({ name: c.name, regulator: c.regulator, city: c.city, status: c.status });
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
      const updated = await updateCandidateSociety(id, editDraft);
      setCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      setRowError({ id, message: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(c: CandidateSociety) {
    if (!window.confirm(`Delete candidate "${c.name}"? This cannot be undone.`)) return;
    setDeletingId(c.id);
    setRowError(null);
    try {
      await deleteCandidateSociety(c.id);
      setCandidates((prev) => prev.filter((x) => x.id !== c.id));
      if (editingId === c.id) cancelEdit();
    } catch (err) {
      setRowError({ id: c.id, message: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AdminNav active="candidates" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Candidate Societies</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Societies identified as demand candidates. Onboard them into Property Intelligence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
        ) : sorted.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No candidate societies found.</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={thStyle}>Name</th>
                  <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('regulator')}>
                    Regulator{sortIndicator('regulator')}
                  </th>
                  <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => toggleSort('city')}>
                    City{sortIndicator('city')}
                  </th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const isEditing = editingId === c.id && editDraft;
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                      {isEditing ? (
                        <>
                          <td style={tdStyle}>
                            <input
                              type="text"
                              value={editDraft!.name}
                              onChange={(e) => setEditDraft({ ...editDraft!, name: e.target.value })}
                              style={editInputStyle}
                            />
                          </td>
                          <td style={tdStyle}>
                            <select
                              value={editDraft!.regulator}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft!,
                                  regulator: e.target.value as CandidateSociety['regulator'],
                                })
                              }
                              style={editInputStyle}
                            >
                              {REGULATOR_OPTIONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <input
                              type="text"
                              value={editDraft!.city}
                              onChange={(e) => setEditDraft({ ...editDraft!, city: e.target.value })}
                              style={editInputStyle}
                            />
                          </td>
                          <td style={tdStyle}>
                            <select
                              value={editDraft!.status}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft!, status: e.target.value as CandidateSociety['status'] })
                              }
                              style={editInputStyle}
                            >
                              {EDIT_STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => saveEdit(c.id)}
                                disabled={savingId === c.id}
                                style={primaryButtonStyle(savingId === c.id)}
                              >
                                {savingId === c.id ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={cancelEdit} disabled={savingId === c.id} style={plainButtonStyle}>
                                Cancel
                              </button>
                            </div>
                            {rowError?.id === c.id && (
                              <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '6px' }}>
                                {rowError.message}
                              </p>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={tdStyle}>{c.name}</td>
                          <td style={tdStyle}>{c.regulator}</td>
                          <td style={tdStyle}>{c.city}</td>
                          <td style={tdStyle}>
                            <span style={statusBadgeStyle}>{c.status}</span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <Link
                                href={`/admin/new-society?name=${encodeURIComponent(c.name)}&city=${encodeURIComponent(c.city)}`}
                                style={plainButtonLinkStyle}
                              >
                                Onboard
                              </Link>
                              <button onClick={() => startEdit(c)} style={plainButtonStyle}>
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(c)}
                                disabled={deletingId === c.id}
                                style={dangerButtonStyle(deletingId === c.id)}
                              >
                                {deletingId === c.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                            {rowError?.id === c.id && (
                              <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '6px' }}>
                                {rowError.message}
                              </p>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

const thStyle: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: '12px' };
const tdStyle: CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};

const editInputStyle: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '13px',
  width: '100%',
  background: '#fff',
};

const statusBadgeStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: '99px',
  background: '#f3f4f6',
  color: 'var(--text)',
};

const plainButtonStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: '#fff',
  cursor: 'pointer',
};

const plainButtonLinkStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  display: 'inline-block',
};

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: 600,
    padding: '6px 12px',
    border: 'none',
    borderRadius: 'var(--radius)',
    background: disabled ? 'var(--muted)' : '#111',
    color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
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
