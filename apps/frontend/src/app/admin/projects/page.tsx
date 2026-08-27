'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { fetchAdminProjects, type ProjectListItem } from '@/lib/api';
import { AdminNav } from '../AdminNav';

// ADMIN PROJECTS LIST — same PAGE_SIZE as admin/house-plans/page.tsx (the
// other real list+pagination page in this admin).
const PAGE_SIZE = 20;

function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

function statusLabel(status: ProjectListItem['status']): string {
  return status.replace('_', ' ');
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminProjects({ page, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setProjects(data.projects);
        setTotalCount(data.total_count);
        setTotalPages(data.total_pages);
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
  }, [page]);

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AdminNav active="projects" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
              ADMIN — INTERNAL ONLY
            </p>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Projects</h1>
            <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
              {loading ? 'Loading…' : `${totalCount} project${totalCount === 1 ? '' : 's'} tracked`}
            </p>
          </div>
          <Link href="/admin/new-project" style={newProjectButtonStyle}>
            + New Project
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
        ) : projects.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
            No projects yet. <Link href="/admin/new-project">Add the first one →</Link>
          </p>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Start date</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <Link href={`/admin/project/${p.id}`} style={rowLinkStyle}>
                        {p.name}
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle}>{statusLabel(p.status)}</span>
                    </td>
                    <td style={tdStyle}>{p.start_date}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatPKR(p.total)}</td>
                  </tr>
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

const rowLinkStyle: CSSProperties = {
  color: 'var(--text)',
  fontWeight: 600,
  textDecoration: 'none',
};

const statusBadgeStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  padding: '3px 10px',
  borderRadius: '99px',
  background: '#f3f4f6',
  color: 'var(--text)',
};

const newProjectButtonStyle: CSSProperties = {
  padding: '10px 16px',
  background: '#111',
  color: '#fff',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

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
