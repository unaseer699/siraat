import Link from 'next/link';
import type { CSSProperties } from 'react';
import { AdminLogoutButton } from './AdminLogoutButton';

type AdminSection =
  | 'candidates'
  | 'societies'
  | 'material-rates'
  | 'daily-rates'
  | 'contractors'
  | 'suppliers'
  | 'house-plans'
  | 'projects'
  | 'whatsapp-review'
  | 'whatsapp-listings'
  | 'ground-reports';

const SECTIONS: { key: AdminSection; href: string; label: string }[] = [
  { key: 'candidates', href: '/admin/candidates', label: 'Candidate Societies' },
  { key: 'societies', href: '/admin/societies', label: 'Societies' },
  { key: 'material-rates', href: '/admin/material-rates', label: 'Material Rates' },
  // Daily market rates (WhatsApp template or manual entry) that price the forecast.
  { key: 'daily-rates', href: '/admin/daily-rates', label: 'Daily Rates' },
  // CONTRACTOR DIRECTORY Chunk 2b — no standalone list page yet, so the tab
  // opens straight into the onboarding form (same as Material Rates doubling
  // as both list and create).
  { key: 'contractors', href: '/admin/contractors', label: 'Contractors' },
  // SUPPLIER DIRECTORY Chunk 2b — same no-standalone-list-page pattern as Contractors.
  { key: 'suppliers', href: '/admin/new-supplier', label: 'Suppliers' },
  // ADMIN CRUD PHASE 1 Chunk 2 — House Plans now has a real list page
  // (admin/house-plans/page.tsx), so this tab points there instead of
  // straight into the create form; that form is still reachable via the
  // list page's "+ Add New" button.
  { key: 'house-plans', href: '/admin/house-plans', label: 'House Plans' },
  // ADMIN PROJECTS LIST — now has a real list page (admin/projects/page.tsx),
  // same fix House Plans already got in ADMIN CRUD PHASE 1 Chunk 2; this tab
  // points there instead of straight into the create form. That form is
  // still reachable via the list page's "+ New Project" button.
  { key: 'projects', href: '/admin/projects', label: 'Projects' },
  // WEEK 1 TECH DEBT — WHATSAPP REVIEW QUEUE. Unmapped senders + stuck
  // drafts, previously API-only (no frontend page existed for it).
  { key: 'whatsapp-review', href: '/admin/whatsapp-review', label: 'WhatsApp Review' },
  // WHATSAPP LISTING INGESTION — separate tab from WhatsApp Review above:
  // that page is the construction-expense queue (unmapped senders, stuck
  // draft expenses); this one is the plot-listing review queue + forwarder
  // allowlist, a distinct concern with its own backend routes.
  { key: 'whatsapp-listings', href: '/admin/whatsapp-listings', label: 'WhatsApp Listings' },
  // GROUND-CONDITION REPORTS — review queue for owner/builder reports.
  { key: 'ground-reports', href: '/admin/ground-reports', label: 'Ground Reports' },
];

// Shared nav row so the admin tools are reachable from one another instead of
// living as isolated pages — sits above each admin screen's own heading.
export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
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
      <AdminLogoutButton />
    </nav>
  );
}
