'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  fetchListingForwarders,
  createListingForwarder,
  deleteListingForwarder,
  fetchWhatsappListingDrafts,
  publishWhatsappListingDraft,
  rejectWhatsappListingDraft,
  publishCleanListingDrafts,
  fetchAdminPropertyListings,
  markPropertyListingSold,
  type WhatsappListingForwarder,
  type WhatsappDraftListing,
  type WhatsappDraftListingStatus,
} from '@/lib/api';
import type { PropertyListingSummary } from '@siraat/shared-types';
import { AdminNav } from '../AdminNav';
import { primaryButtonStyle, dangerButtonStyle } from '../buttonStyles';

// WHATSAPP LISTING INGESTION — admin UI for the two concerns this feature
// adds: which numbers forward inventory (allowlist), and the resulting
// per-plot draft queue (one-click Publish/Reject, no confirm-reply loop —
// the founder has already verified the source message before forwarding).

const DRAFT_STATUS_OPTIONS: WhatsappDraftListingStatus[] = ['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'];

const BLOCKING_FLAGS = ['MISSING_PRICE', 'PRICE_OUTLIER'];
const FLAG_LABELS: Record<string, string> = {
  MISSING_PRICE: 'No price',
  PRICE_OUTLIER: 'Price outlier',
  MISSING_SIZE: 'No size',
  REFRESH: 'Refresh',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function AdminWhatsappListingsPage() {
  const [forwarders, setForwarders] = useState<WhatsappListingForwarder[]>([]);
  const [forwardersLoading, setForwardersLoading] = useState(true);
  const [forwardersError, setForwardersError] = useState<string | null>(null);
  const [newWaId, setNewWaId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addingForwarder, setAddingForwarder] = useState(false);

  const [draftStatus, setDraftStatus] = useState<WhatsappDraftListingStatus>('PENDING_REVIEW');
  const [drafts, setDrafts] = useState<WhatsappDraftListing[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [draftsError, setDraftsError] = useState<string | null>(null);

  // Per-draft phone edits (draft id -> text); absent = keep the extracted number.
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const [live, setLive] = useState<PropertyListingSummary[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveFilter, setLiveFilter] = useState('');

  function loadLive() {
    setLiveLoading(true);
    setLiveError(null);
    fetchAdminPropertyListings(true)
      .then(setLive)
      .catch((err) => setLiveError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLiveLoading(false));
  }
  useEffect(loadLive, []);

  const cleanCount = drafts.filter(
    (d) => d.status === 'PENDING_REVIEW' && !(d.flags ?? []).some((f) => BLOCKING_FLAGS.includes(f)),
  ).length;

  async function handlePublishClean() {
    if (!window.confirm(`Publish ${cleanCount} clean draft(s)? Flagged ones are left for manual review.`)) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const r = await publishCleanListingDrafts();
      setBulkMessage(`Published ${r.published}, left for review ${r.skipped}, failed ${r.failed}.`);
      loadDrafts();
      loadLive();
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : 'Bulk publish failed');
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleMarkSold(l: PropertyListingSummary) {
    if (!window.confirm(`Mark plot ${l.plot_number} (${l.society_name ?? l.society_name_raw}) as sold? This hides every dealer's offer for it.`)) return;
    setActingId(l.id);
    try {
      await markPropertyListingSold(l.id);
      loadLive();
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Mark sold failed');
    } finally {
      setActingId(null);
    }
  }

  function loadForwarders() {
    let cancelled = false;
    setForwardersLoading(true);
    setForwardersError(null);
    fetchListingForwarders()
      .then((data) => {
        if (!cancelled) setForwarders(data);
      })
      .catch((err) => {
        if (!cancelled) setForwardersError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setForwardersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(loadForwarders, []);

  function loadDrafts() {
    let cancelled = false;
    setDraftsLoading(true);
    setDraftsError(null);
    fetchWhatsappListingDrafts(draftStatus)
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

  async function handleAddForwarder() {
    if (!newWaId.trim() || !newLabel.trim()) return;
    setAddingForwarder(true);
    setForwardersError(null);
    try {
      await createListingForwarder({ wa_id: newWaId.trim(), label: newLabel.trim(), created_by: 'admin' });
      setNewWaId('');
      setNewLabel('');
      loadForwarders();
    } catch (err) {
      setForwardersError(err instanceof Error ? err.message : 'Failed to add forwarder');
    } finally {
      setAddingForwarder(false);
    }
  }

  async function handleDeleteForwarder(id: string) {
    if (!window.confirm('Remove this number from the listing-forwarder allowlist?')) return;
    try {
      await deleteListingForwarder(id);
      setForwarders((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setForwardersError(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  async function handlePublish(draft: WhatsappDraftListing) {
    setActingId(draft.id);
    setRowError(null);
    try {
      const edited = phoneEdits[draft.id];
      // Untouched -> undefined (keep extracted); cleared -> null; else the new value.
      const contactPhone = edited === undefined ? undefined : edited.trim() === '' ? null : edited.trim();
      await publishWhatsappListingDraft(draft.id, contactPhone);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      loadLive();
    } catch (err) {
      setRowError({ id: draft.id, message: err instanceof Error ? err.message : 'Publish failed' });
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(draft: WhatsappDraftListing) {
    const input = window.prompt(`Reject plot ${draft.plot_number} — reason (optional):`);
    if (input === null) return;
    const reason = input.trim() === '' ? null : input.trim();

    setActingId(draft.id);
    setRowError(null);
    try {
      await rejectWhatsappListingDraft(draft.id, reason);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch (err) {
      setRowError({ id: draft.id, message: err instanceof Error ? err.message : 'Reject failed' });
    } finally {
      setActingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <AdminNav active="whatsapp-listings" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>WhatsApp Listing Ingestion</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Daily plot inventory forwarded via WhatsApp. Review each parsed plot and Publish or Reject —
            no confirm-reply loop, since the source message is already verified before it's forwarded.
          </p>
        </div>

        {/* ─── Forwarder Allowlist ──────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Listing Forwarders</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Numbers on this list route to the listing queue below instead of the construction-expense flow.
          </p>

          {forwardersError && <ErrorBanner message={forwardersError} />}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={newWaId}
              onChange={(e) => setNewWaId(e.target.value)}
              placeholder="wa_id (digits only, e.g. 923001234567)"
              style={inputStyle}
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Founder — personal number)"
              style={inputStyle}
            />
            <button
              onClick={handleAddForwarder}
              disabled={addingForwarder || !newWaId.trim() || !newLabel.trim()}
              style={primaryButtonStyle(addingForwarder)}
            >
              Add Forwarder
            </button>
          </div>

          {forwardersLoading ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
          ) : forwarders.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No listing forwarders registered yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={thStyle}>wa_id</th>
                    <th style={thStyle}>Label</th>
                    <th style={thStyle}>Added</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {forwarders.map((f) => (
                    <tr key={f.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{f.wa_id}</td>
                      <td style={tdStyle}>{f.label}</td>
                      <td style={tdStyle}>{formatTimestamp(f.created_at)}</td>
                      <td style={tdStyle}>
                        <button onClick={() => handleDeleteForwarder(f.id)} style={dangerButtonStyle(false)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Draft Listings Review Queue ─────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Draft Listings</h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {draftStatus === 'PENDING_REVIEW' && (
                <button
                  onClick={handlePublishClean}
                  disabled={bulkBusy || cleanCount === 0}
                  style={primaryButtonStyle(bulkBusy || cleanCount === 0)}
                >
                  Publish all clean ({cleanCount})
                </button>
              )}
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Status</label>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as WhatsappDraftListingStatus)}
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
          {bulkMessage && <p style={{ fontSize: '13px', fontWeight: 600 }}>{bulkMessage}</p>}

          {draftsLoading ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
          ) : drafts.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
              No {draftStatus.toLowerCase().replace('_', ' ')} listings.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={thStyle}>Society</th>
                    <th style={thStyle}>Block</th>
                    <th style={thStyle}>Plot</th>
                    <th style={thStyle}>Size</th>
                    <th style={thStyle}>Price (Lac)</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Received</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{d.society_name_raw}</td>
                      <td style={tdStyle}>{d.block ?? '—'}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{d.plot_number}</td>
                      <td style={tdStyle}>{d.size_raw ?? '—'}</td>
                      <td style={tdStyle}>{d.price_lac ?? '—'}</td>
                      <td style={tdStyle}>
                        {d.status_raw ?? '—'}
                        {(d.flags ?? []).length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {d.flags.map((f) => (
                              <span
                                key={f}
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: BLOCKING_FLAGS.includes(f) ? '#fef3c7' : '#f3f4f6',
                                  color: BLOCKING_FLAGS.includes(f) ? '#92400e' : 'var(--muted)',
                                }}
                              >
                                {FLAG_LABELS[f] ?? f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {d.status === 'PENDING_REVIEW' ? (
                          <input
                            aria-label={`Contact phone for plot ${d.plot_number}`}
                            value={phoneEdits[d.id] ?? d.contact_phone ?? ''}
                            onChange={(e) => setPhoneEdits((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            placeholder="optional"
                            style={{ ...inputStyle, minWidth: '140px', padding: '6px 10px' }}
                          />
                        ) : (
                          d.contact_phone ?? '—'
                        )}
                      </td>
                      <td style={tdStyle}>{formatTimestamp(d.created_at)}</td>
                      <td style={tdStyle}>
                        {d.status === 'PENDING_REVIEW' && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handlePublish(d)}
                              disabled={actingId === d.id}
                              style={primaryButtonStyle(actingId === d.id)}
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => handleReject(d)}
                              disabled={actingId === d.id}
                              style={dangerButtonStyle(actingId === d.id)}
                            >
                              Reject
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

        {/* ─── Published (live) listings ───────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Published Listings ({live.length})</h2>
          <input
            value={liveFilter}
            onChange={(e) => setLiveFilter(e.target.value)}
            placeholder="Filter by society, block or plot number"
            style={inputStyle}
          />
          {liveError && <ErrorBanner message={liveError} />}
          {liveLoading ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
          ) : live.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No live listings.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={thStyle}>Society</th>
                    <th style={thStyle}>Block</th>
                    <th style={thStyle}>Plot</th>
                    <th style={thStyle}>Size</th>
                    <th style={thStyle}>Price (Lac)</th>
                    <th style={thStyle}>Dealer</th>
                    <th style={thStyle}>Last confirmed</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {live
                    .filter((l) => {
                      const q = liveFilter.trim().toLowerCase();
                      if (!q) return true;
                      return [l.society_name ?? '', l.society_name_raw, l.block ?? '', l.plot_number]
                        .join(' ')
                        .toLowerCase()
                        .includes(q);
                    })
                    .map((l) => (
                      <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={tdStyle}>{l.society_name ?? l.society_name_raw}</td>
                        <td style={tdStyle}>{l.block ?? '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{l.plot_number}</td>
                        <td style={tdStyle}>{l.size_marla ?? '—'}</td>
                        <td style={tdStyle}>{l.price_lac ?? '—'}</td>
                        <td style={tdStyle}>{l.contact_phone ?? '—'}</td>
                        <td style={tdStyle}>
                          {formatTimestamp(l.last_confirmed_at)}
                          {l.may_be_sold && (
                            <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: 700, color: '#92400e' }}>
                              may be sold
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => handleMarkSold(l)}
                            disabled={actingId === l.id}
                            style={dangerButtonStyle(actingId === l.id)}
                          >
                            Mark sold
                          </button>
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

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};

const inputStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  minWidth: '220px',
};
