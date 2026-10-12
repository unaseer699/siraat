'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupplierSummary } from '@siraat/shared-types';
import { fetchSuppliers } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { VerifiedToggle } from '@/components/VerifiedToggle';
import { primaryButtonStyle } from '../buttonStyles';

export default function AdminSuppliersPage() {
  const [list, setList] = useState<SupplierSummary[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliers({ limit: 100 }).then((r) => setList(r.suppliers)).catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = (list ?? []).filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.contact_phone.replace(/\D/g, '').includes(needle.replace(/\D/g, '') || '§'));

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 40px', gap: '24px' }}>
      <div style={{ maxWidth: '760px', width: '100%' }}>
        <AdminNav active="suppliers" />
      </div>
      <article style={{ maxWidth: '760px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Suppliers</h1>
          <Link href="/admin/new-supplier" style={{ ...primaryButtonStyle(false), textDecoration: 'none' }}>+ Onboard supplier</Link>
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" aria-label="Search suppliers" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', background: '#fff' }} />
        {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}
        {!list && !error && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</p>}
        {list && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shown.map((s) => (
              <li key={s.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/supplier/${s.id}`} style={{ fontWeight: 700, fontSize: '15px' }}>{s.name}</Link>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>{s.service_cities.join(', ')} · {s.contact_phone}</p>
                </div>
                <VerifiedToggle kind="supplier" id={s.id} initial={s.verification_status === 'VERIFIED'} />
              </li>
            ))}
            {shown.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No suppliers match.</p>}
          </ul>
        )}
      </article>
    </main>
  );
}
