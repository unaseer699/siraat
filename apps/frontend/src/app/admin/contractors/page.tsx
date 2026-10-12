'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ContractorSummary } from '@siraat/shared-types';
import { deleteContractor, fetchContractors, fetchPendingProjects, type ContractorProject } from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { AdminProjectCard } from '@/components/AdminProjectCard';
import { VerifiedToggle } from '@/components/VerifiedToggle';
import { dangerButtonStyle, primaryButtonStyle } from '../buttonStyles';

export default function AdminContractorsPage() {
  const [list, setList] = useState<ContractorSummary[] | null>(null);
  const [pending, setPending] = useState<ContractorProject[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function remove(c: ContractorSummary) {
    if (!window.confirm(`Delete ${c.name}? This also deletes their portfolio projects and photos. It cannot be undone.`)) return;
    setRowError(null);
    try {
      await deleteContractor(c.id);
      setList((l) => (l ?? []).filter((x) => x.id !== c.id));
    } catch (e) {
      setRowError(e instanceof Error ? e.message.replace(/^API error \d+: /, '') : 'Could not delete');
    }
  }

  function loadPending() {
    fetchPendingProjects().then(setPending).catch(() => setPending([]));
  }
  useEffect(() => {
    fetchContractors({ limit: 100 }).then((r) => setList(r.contractors)).catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
    loadPending();
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = (list ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.contact_phone.replace(/\D/g, '').includes(needle.replace(/\D/g, '') || '§'));

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 40px', gap: '24px' }}>
      <div style={{ maxWidth: '760px', width: '100%' }}>
        <AdminNav active="contractors" />
      </div>
      <article style={{ maxWidth: '760px', width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Contractors</h1>
          <Link href="/admin/new-contractor" style={{ ...primaryButtonStyle(false), textDecoration: 'none' }}>+ Onboard contractor</Link>
        </div>

        {pending.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Projects waiting for review ({pending.length})</h2>
            <p style={{ fontSize: '13px', color: '#78350f', margin: 0 }}>Sent by contractors. Check the photos look like real finished work before publishing.</p>
            {pending.map((p) => <AdminProjectCard key={p.id} project={p} showContractor onChanged={loadPending} />)}
          </section>
        )}

        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" aria-label="Search contractors" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', background: '#fff' }} />

        {error && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{error}</p>}
        {rowError && <p style={{ color: 'var(--error)', fontSize: '13px' }}>{rowError}</p>}
        {!list && !error && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</p>}
        {list && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shown.map((c) => (
              <li key={c.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/contractor/${c.id}`} style={{ fontWeight: 700, fontSize: '15px' }}>{c.name}</Link>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>{c.service_cities.join(', ')} · {c.contact_phone}</p>
                </div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '13px', fontWeight: 600, alignItems: 'center' }}>
                  <Link href={`/admin/contractor/${c.id}/portfolio`}>Portfolio</Link>
                  <Link href={`/admin/new-contractor?edit=${c.id}`}>Edit</Link>
                  <VerifiedToggle kind="contractor" id={c.id} initial={c.verification_status === 'VERIFIED'} />
                  <button type="button" onClick={() => remove(c)} style={dangerButtonStyle(false)}>Delete</button>
                </div>
              </li>
            ))}
            {shown.length === 0 && <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No contractors match.</p>}
          </ul>
        )}
      </article>
    </main>
  );
}
