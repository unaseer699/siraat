'use client';

import Link from 'next/link';
import type { PropertyPlotGroup } from '@siraat/shared-types';
import { PlotGroupCard, ListingDisclaimer } from '@/components/PlotListings';

// Shown under the search box when no verified society matched but live plot
// listings do. Listings are dealer-reported, so they carry their own
// disclaimer and are never presented as verified.
export function PlotMatches({ plots, total, href }: { plots: PropertyPlotGroup[]; total: number; href: string }) {
  return (
    <section style={{ width: '100%', maxWidth: '980px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>
          {total} live plot{total === 1 ? '' : 's'} match your search
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0' }}>
          No verified society matched, but these plots are currently listed by dealers.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {plots.map((p) => (
          <PlotGroupCard key={p.key} plot={p} showSociety />
        ))}
      </div>
      {total > plots.length && (
        <Link href={href} style={{ fontSize: '14px', fontWeight: 700, color: '#1a56db' }}>
          See all {total} plots →
        </Link>
      )}
      <ListingDisclaimer />
    </section>
  );
}
