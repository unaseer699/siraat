'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { fetchCandidateSocieties, type CandidateSociety } from '@/lib/api';
import { AdminNav } from '../AdminNav';

type StatusFilter = 'ALL' | CandidateSociety['status'];
type SortKey = 'regulator' | 'city';

const STATUS_OPTIONS: StatusFilter[] = ['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'ONBOARDED'];

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateSociety[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              background: '#fff',
            }}
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
            <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '14px' }}>
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
                {sorted.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{c.name}</td>
                    <td style={tdStyle}>{c.regulator}</td>
                    <td style={tdStyle}>{c.city}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '99px',
                          background: '#f3f4f6',
                          color: 'var(--text)',
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <Link
                        href={`/admin/new-society?name=${encodeURIComponent(c.name)}&city=${encodeURIComponent(c.city)}`}
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          padding: '6px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          display: 'inline-block',
                        }}
                      >
                        Onboard this society
                      </Link>
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

const thStyle: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: '12px' };
const tdStyle: CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };
