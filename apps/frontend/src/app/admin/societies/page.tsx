'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/Spinner';
import { fetchSocieties } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { inputStyle } from '../constants';

type Row = { id: string; name: string; city: string; verification_status: string };

export default function AdminSocietiesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const all: Row[] = [];
        for (let page = 1; page <= 20; page++) {
          const res = await fetchSocieties({ page, limit: 100 });
          all.push(...res.societies);
          if (page >= res.total_pages) break;
        }
        setRows(all);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load societies');
      }
    })();
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!rows) return [];
    return needle ? rows.filter((r) => `${r.name} ${r.city}`.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' }}>
      <article style={{ maxWidth: '760px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <AdminNav active="societies" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Societies</h1>
          <Link href="/admin/new-society" style={{ fontSize: '13px', fontWeight: 600 }}>+ Onboard society</Link>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or city…"
          style={inputStyle}
        />
        {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}
        {!rows && !error && <Spinner />}
        {rows && (
          <>
            <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{shown.length} of {rows.length}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {shown.map((r) => (
                <li
                  key={r.id}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
                >
                  <span>
                    <strong>{r.name}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '13px' }}> · {r.city} · {r.verification_status}</span>
                  </span>
                  <span style={{ display: 'flex', gap: '14px', fontSize: '13px', fontWeight: 600 }}>
                    <Link href={`/admin/society/${r.id}/edit`}>Edit details</Link>
                    <Link href={`/admin/society/${r.id}/add-claim`}>Claims &amp; evidence</Link>
                    <Link href={`/society/${r.id}`}>View</Link>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>
    </main>
  );
}
