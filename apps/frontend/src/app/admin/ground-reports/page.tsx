'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  fetchGroundReportSubmissions,
  fetchGroundReportAttachmentUrl,
  approveGroundReport,
  rejectGroundReport,
  type GroundReportSubmission,
  type GroundReportStatus,
} from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { primaryButtonStyle, dangerButtonStyle } from '../buttonStyles';

// GROUND-CONDITION REPORTS — review queue. Submissions are UNTRUSTED_DATA;
// Approve is the human step that turns one into a public FACT.

const STATUSES: GroundReportStatus[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'];
const th: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: '12px' };
const td: CSSProperties = { padding: '10px 14px', verticalAlign: 'top' };

export default function AdminGroundReportsPage() {
  const [status, setStatus] = useState<GroundReportStatus>('PENDING_REVIEW');
  const [rows, setRows] = useState<GroundReportSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchGroundReportSubmissions(status)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [status]);

  async function act(id: string, fn: () => Promise<void>) {
    setActingId(id);
    setError(null);
    try {
      await fn();
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <AdminNav active="ground-reports" />
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADMIN — INTERNAL ONLY</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Ground-Condition Reports</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Owner/builder reports of soil and foundation findings. Treat every entry as unverified: call the reporter if
            anything looks off. Approving makes it count toward the block summary shown to buyers; the phone is never public.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as GroundReportStatus)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff' }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {error && <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '13px' }}>{error}</div>}

        {loading ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No {status.toLowerCase().replace('_', ' ')} reports.</p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={th}>Where</th>
                  <th style={th}>Ground</th>
                  <th style={th}>Foundation</th>
                  <th style={th}>Details</th>
                  <th style={th}>Reporter</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>
                      <strong>{r.society_name_raw}</strong>
                      <div>Block {r.block}{r.plot_number ? ` · Plot ${r.plot_number}` : ''}</div>
                    </td>
                    <td style={td}>{r.ground_condition}{r.soil_test_done ? ' · soil test' : ''}</td>
                    <td style={td}>
                      {r.foundation_type}
                      {r.foundation_depth_ft !== null && <div>{r.foundation_depth_ft} ft</div>}
                    </td>
                    <td style={{ ...td, maxWidth: '280px' }}>
                      {r.extra_cost_lac !== null && <div>Extra cost: {r.extra_cost_lac} Lac</div>}
                      {r.build_year !== null && <div>Built: {r.build_year}</div>}
                      {r.notes && <div style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{r.notes}</div>}
                      {(r.attachments ?? []).length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                          {r.attachments.map((a, i) => (
                            <button
                              key={a.key}
                              onClick={() =>
                                fetchGroundReportAttachmentUrl(r.id, i)
                                  .then((res) => window.open(res.url, '_blank', 'noopener,noreferrer'))
                                  .catch((e) => setError(e instanceof Error ? e.message : 'Could not open file'))
                              }
                              style={{ fontSize: '12px', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}
                            >
                              {a.content_type === 'application/pdf' ? 'PDF' : 'Photo'} {i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      {r.reporter_role}{r.source === 'WHATSAPP' ? ' · via WhatsApp' : ''}
                      <div>{r.reporter_phone}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleString()}</div>
                    </td>
                    <td style={td}>
                      {r.status === 'PENDING_REVIEW' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button disabled={actingId === r.id} onClick={() => act(r.id, () => approveGroundReport(r.id))} style={primaryButtonStyle(actingId === r.id)}>Approve</button>
                          <button
                            disabled={actingId === r.id}
                            onClick={() => {
                              const reason = window.prompt('Reject — reason (optional):');
                              if (reason === null) return;
                              void act(r.id, () => rejectGroundReport(r.id, reason.trim() || null));
                            }}
                            style={dangerButtonStyle(actingId === r.id)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
