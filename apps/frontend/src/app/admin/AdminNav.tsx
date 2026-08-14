import Link from 'next/link';
import type { CSSProperties } from 'react';

type AdminSection = 'candidates' | 'material-rates';

const SECTIONS: { key: AdminSection; href: string; label: string }[] = [
  { key: 'candidates', href: '/admin/candidates', label: 'Candidate Societies' },
  { key: 'material-rates', href: '/admin/material-rates', label: 'Material Rates' },
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
