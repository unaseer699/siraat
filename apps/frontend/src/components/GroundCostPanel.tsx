'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { GroundBlockSummary, GroundConditionsResponse, PropertyListingFacets } from '@siraat/shared-types';
import { fetchGroundConditions, fetchPropertyListings } from '@/lib/api';

// Links the estimator to what owners/builders actually reported underground.
// Deliberately separate from the BOQ itself: the estimate API is unchanged,
// and this only ADDS a reported range for the plot's block when one exists.
const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};

export function GroundCostPanel() {
  const [societies, setSocieties] = useState<PropertyListingFacets['societies']>([]);
  const [societyKey, setSocietyKey] = useState('');
  const [data, setData] = useState<GroundConditionsResponse | null>(null);
  const [block, setBlock] = useState('');

  useEffect(() => {
    fetchPropertyListings()
      .then((r) => setSocieties(r.facets.societies))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setData(null);
    setBlock('');
    if (!societyKey) return;
    fetchGroundConditions(societyKey)
      .then(setData)
      .catch(() => undefined);
  }, [societyKey]);

  const society = societies.find((s) => s.key === societyKey);
  const summary: GroundBlockSummary | undefined = data?.blocks.find((b) => b.block === block);

  return (
    <section
      style={{
        width: '100%',
        maxWidth: '680px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        background: '#fff',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Check your plot&apos;s ground before you budget</h2>
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Filled or uneven land can need a deeper foundation or piling — a cost the estimate above does not include. See
        what owners in your block reported.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select aria-label="Society" value={societyKey} onChange={(e) => setSocietyKey(e.target.value)} style={selectStyle}>
          <option value="">Select society…</option>
          {societies.map((s) => (
            <option key={s.key} value={s.key}>{s.name}</option>
          ))}
        </select>
        {data && data.blocks.length > 0 && (
          <select aria-label="Block" value={block} onChange={(e) => setBlock(e.target.value)} style={selectStyle}>
            <option value="">Select block…</option>
            {data.blocks.map((b) => (
              <option key={b.block} value={b.block}>Block {b.block} ({b.report_count})</option>
            ))}
          </select>
        )}
      </div>

      {societyKey && data?.state === 'NOT_COVERED' && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          No reports yet for this society.{' '}
          <Link href={`/report-ground?society=${encodeURIComponent(society?.name ?? '')}`} style={{ color: '#1a56db', fontWeight: 600 }}>
            Built here? Report what you found →
          </Link>
        </p>
      )}

      {summary && (
        <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {summary.extra_cost_lac_median !== null ? (
            <p>
              <strong>Reported extra foundation cost: ~{summary.extra_cost_lac_median} Lac</strong> (median of{' '}
              {summary.extra_cost_report_count} report{summary.extra_cost_report_count === 1 ? '' : 's'}) — add this on top
              of the estimate if your plot behaves like its neighbours.
            </p>
          ) : (
            <p>No extra-cost figures reported for this block yet.</p>
          )}
          <p style={{ color: 'var(--muted)' }}>
            {summary.deep_foundation_count} of {summary.report_count} reports needed a deep foundation or piling
            {summary.depth_ft_median !== null ? ` · typical depth ${summary.depth_ft_median} ft` : ''}
            {summary.soil_test_count > 0 ? ` · ${summary.soil_test_count} backed by a soil test` : ''}.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Based on owner/builder reports reviewed by Siraat (confidence {Math.round(summary.confidence_score * 100)}%
            {summary.state === 'DEGRADED_SUCCESS' ? ', few reports so far' : ''}
            {summary.is_stale ? ', older reports' : ''}). An indicator, not a soil test — get a geotechnical test for your
            own plot before you build.
          </p>
        </div>
      )}
    </section>
  );
}
