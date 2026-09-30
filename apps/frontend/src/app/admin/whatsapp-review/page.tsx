'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  fetchUnmappedWhatsappMessages,
  fetchWhatsappDrafts,
  voidWhatsappDraft,
  resendWhatsappDraftPrompt,
  type WhatsappUnmappedMessage,
  type WhatsappDraft,
  type WhatsappDraftStatus,
} from '@/lib/api';
import { AdminNav } from '../AdminNav';

// WEEK 1 TECH DEBT — TASK A. Frontend for the WHATSAPP INTEGRATION Phase 4
// admin review-queue endpoints (admin.controller.ts): unmapped senders (no
// project mapping at receipt time) and stuck/pending draft expenses. No new
// backend endpoints — void/resend-prompt are the only actions the existing
// API supports for drafts; unmapped senders are list-only here (mapping
// creation has no admin page of its own yet, out of scope for this task).

const DRAFT_STATUS_OPTIONS: WhatsappDraftStatus[] = ['PENDING', 'CONFIRMED', 'REJECTED', 'EDITED', 'VOID'];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AdminWhatsappReviewPage() {
  const [unmapped, setUnmapped] = useState<WhatsappUnmappedMessage[]>([]);
  const [unmappedLoading, setUnmappedLoading] = useState(true);
  const [unmappedError, setUnmappedError] = useState<string | null>(null);

  const [draftStatus, setDraftStatus] = useState<WhatsappDraftStatus>('PENDING');
  const [drafts, setDrafts] = useState<WhatsappDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsError, setDraftsError] = useState<string | null>(null);

  // Per-row action state — mirrors admin/candidates/page.tsx's editingId/
  // savingId/rowError pattern (one row error slot, keyed by id, so an action
  // failure on one row doesn't blank out the whole table).
  const [actingId, setActingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUnmappedLoading(true);
    setUnmappedError(null);
    fetchUnmappedWhatsappMessages()
      .then((data) => {
        if (!cancelled) setUnmapped(data);
      })
      .catch((err) => {
        if (!cancelled) setUnmappedError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setUnmappedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function loadDrafts() {
    let cancelled = false;
    setDraftsLoading(true);
    setDraftsError(null);
    fetchWhatsappDrafts(draftStatus)
      .then((data) => {
        if (!cancelled) setDrafts(data);
      })
      .catch((err) => {
        if (!cancelled) setDraftsError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setDraftsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(loadDrafts, [draftStatus]);

  async function handleVoid(draft: WhatsappDraft) {
    const input = window.prompt(`Void draft "${draft.parsed_item ?? '(no item parsed)'}" — reason (optional):`);
    if (input === null) return; // Cancelled
    const reason = input.trim() === '' ? null : input.trim();

    setActingId(draft.id);
    setRowError(null);
    try {
      await voidWhatsappDraft(draft.id, reason);
      // Voided draft no longer matches the current status filter (unless
      // already viewing VOID) — drop it from the list rather than refetch.
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch (err) {
      setRowError({ id: draft.id, message: err instanceof Error ? err.message : 'Void failed' });
    } finally {
      setActingId(null);
    }
  }

  async function handleResend(draft: WhatsappDraft) {
    if (!window.confirm('Resend the confirmation prompt for this draft?')) return;

    setActingId(draft.id);
    setRowError(null);
    try {
      await resendWhatsappDraftPrompt(draft.id);
    } catch (err) {
      setRowError({ id: draft.id, message: err instanceof Error ? err.message : 'Resend failed' });
    } finally {
      setActingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <AdminNav active="whatsapp-review" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>WhatsApp Review Queue</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Unmapped senders and stuck draft expenses from the WhatsApp integration.
          </p>
        </div>

        {/* ─── Unmapped Senders ─────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Unmapped Senders</h2>

          {unmappedError && <ErrorBanner message={unmappedError} />}

          {unmappedLoading ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
          ) : unmapped.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No unmapped senders — everything's mapped.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={thStyle}>Phone (wa_id)</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Message</th>
                    <th style={thStyle}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {unmapped.map((m) => (
                    <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{m.wa_id}</td>
                      <td style={tdStyle}>{m.message_type}</td>
                      <td style={{ ...tdStyle, maxWidth: '360px' }}>
                        {m.message_text ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td style={tdStyle}>{formatTimestamp(m.wa_timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Stuck / Pending Draft Expenses ───────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Draft Expenses</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Status</label>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as WhatsappDraftStatus)}
                style={selectStyle}
              >
                {DRAFT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {draftsError && <ErrorBanner message={draftsError} />}

          {draftsLoading ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
          ) : drafts.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No {draftStatus.toLowerCase()} drafts.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={thStyle}>Project</th>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Qty / Unit</th>
                    <th style={thStyle}>Rate</th>
                    <th style={thStyle}>Confidence</th>
                    <th style={thStyle}>Received</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <Link href={`/admin/project/${d.project_ref}`} style={rowLinkStyle}>
                          {d.project_ref.slice(0, 8)}…
                        </Link>
                      </td>
                      <td style={tdStyle}>
                        {d.parsed_item ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                        {d.stale && <span style={staleBadgeStyle}>STALE</span>}
                      </td>
                      <td style={tdStyle}>
                        {d.parsed_quantity ?? '—'} {d.parsed_unit ?? ''}
                      </td>
                      <td style={tdStyle}>{d.parsed_rate ?? '—'}</td>
                      <td style={tdStyle}>{d.confidence}</td>
                      <td style={tdStyle}>{formatTimestamp(d.created_at)}</td>
                      <td style={tdStyle}>
                        {d.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleResend(d)}
                              disabled={actingId === d.id}
                              style={plainButtonStyle}
                            >
                              Resend
                            </button>
                            <button
                              onClick={() => handleVoid(d)}
                              disabled={actingId === d.id}
                              style={dangerButtonStyle(actingId === d.id)}
                            >
                              Void
                            </button>
                          </div>
                        )}
                        {rowError?.id === d.id && (
                          <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '6px' }}>
                            {rowError.message}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

const thStyle: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: '12px' };
const tdStyle: CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };

const rowLinkStyle: CSSProperties = {
  color: 'var(--text)',
  fontWeight: 600,
  textDecoration: 'none',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};

const staleBadgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: '99px',
  background: '#fef3c7',
  color: '#92400e',
  marginLeft: '8px',
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
