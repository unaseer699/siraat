import Link from 'next/link';
import type { CSSProperties } from 'react';

type AdminSection = 'candidates' | 'material-rates' | 'contractors' | 'suppliers';

const SECTIONS: { key: AdminSection; href: string; label: string }[] = [
  { key: 'candidates', href: '/admin/candidates', label: 'Candidate Societies' },
  { key: 'material-rates', href: '/admin/material-rates', label: 'Material Rates' },
  // CONTRACTOR DIRECTORY Chunk 2b — no standalone list page yet, so the tab
  // opens straight into the onboarding form (same as Material Rates doubling
  // as both list and create).
  { key: 'contractors', href: '/admin/new-contractor', label: 'Contractors' },
  // SUPPLIER DIRECTORY Chunk 2b — same no-standalone-list-page pattern as Contractors.
  { key: 'suppliers', href: '/admin/new-supplier', label: 'Suppliers' },
];

// Shared nav row so the admin tools are reachable from one another instead of
// living as isolated pages — sits above each admin screen's own heading.
export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)' }}>
      {SECTIONS.map((s) => {
        const isActive = s.key === active;
        const style: CSSProperties = {
          padding: '10px 14px',
          fontSize: '13px',
          fontWeight: 600,
          color: isActive ? 'var(--text)' : 'var(--muted)',
          borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
          marginBottom: '-1px',
        };
        return (
          <Link key={s.key} href={s.href} style={style}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
