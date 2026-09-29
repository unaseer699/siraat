'use client';

import { Wrench, Package, Home as HomeIcon } from 'lucide-react';
import { BackLink } from '@/components/BackLink';
import { QuickAccessCard } from '@/components/QuickAccessCard';

// TOOLS PAGE (P2) — minimal landing for the three directories that used to be
// primary homepage cards (Contractors/Suppliers/House Plans) before the
// homepage redesign. Reuses QuickAccessCard and the exact same copy/icons
// those cards had on the homepage — no new design system, no new copy.
export default function ToolsPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 48px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink label="← Back to home" fallbackHref="/" />

        <header>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Tools</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Directories for finding verified trades, materials, and house plans.
          </p>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <QuickAccessCard
            href="/contractors"
            icon={Wrench}
            title="Contractors"
            subtitle="Find verified trades near you"
            ariaLabel="Find contractors"
          />
          <QuickAccessCard
            href="/suppliers"
            icon={Package}
            title="Suppliers"
            subtitle="Find verified material suppliers"
            ariaLabel="Find suppliers"
          />
          <QuickAccessCard
            href="/house-plans"
            icon={HomeIcon}
            title="House Plans"
            subtitle="Browse ready-made floor plans"
            ariaLabel="Browse house plans"
          />
        </div>
      </div>
    </main>
  );
}
