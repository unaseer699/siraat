'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { GroundBlockSummary, GroundPlotReport, GroundConditionsResponse, PropertyListingFacets } from '@siraat/shared-types';
import { fetchGroundConditions, fetchPropertyListings } from '@/lib/api';

// Links the estimator to what owners/builders actually reported underground.
// Deliberately separate from the BOQ itself: the estimate API is unchanged,
// and this only ADDS a reported range for the plot's block when one exists.
const selectStyle: React.CSSProperties = {
  padding: '12px 14px',
  border: '1.5px solid var(--border)',
  borderRadius: '10px',
  fontSize: '15px',
  background: '#fff',
};

export function GroundCostPanel() {
  const [societies, setSocieties] = useState<PropertyListingFacets['societies']>([]);
  const [societyKey, setSocietyKey] = useState('');
  const [data, setData] = useState<GroundConditionsResponse | null>(null);
  const [block, setBlock] = useState('');
  const [myPlot, setMyPlot] = useState('');

  useEffect(() => {
    fetchPropertyListings()
      .then((r) => setSocieties(r.facets.societies))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setData(null);
    setBlock('');
    setMyPlot('');
    if (!societyKey) return;
    fetchGroundConditions(societyKey)
      .then(setData)
      .catch(() => undefined);
  }, [societyKey]);

  const society = societies.find((s) => s.key === societyKey);
  const summary: GroundBlockSummary | undefined = data?.blocks.find((b) => b.block === block);

  const verdict = summary ? groundVerdict(summary) : null;
  const reportHref = `/report-ground?society=${encodeURIComponent(society?.name ?? '')}`;

  return (
    <section
      id="ground-check"
      style={{
        width: '100%',
        maxWidth: '680px',
        border: '2px solid #fcd9a8',
        borderRadius: '16px',
        background: 'linear-gradient(180deg, #fffaf2 0%, #fff 60%)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{ fontSize: '26px', lineHeight: 1, background: '#fff', border: '1px solid #fcd9a8', borderRadius: '12px', padding: '10px' }}
        >
          ⛏️
        </span>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.25 }}>Will your plot need a deeper foundation?</h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '4px' }}>
            Filled or uneven land can add lakhs for piling or a deeper foundation, which the estimate above does not include.
            Pick your society and block to see what owners there actually paid.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <select aria-label="Society" value={societyKey} onChange={(e) => setSocietyKey(e.target.value)} style={selectStyle}>
          <option value="">1. Select society…</option>
          {societies.map((s) => (
            <option key={s.key} value={s.key}>{s.name}</option>
          ))}
        </select>
        {data && data.blocks.length > 0 && (
          <select aria-label="Block" value={block} onChange={(e) => { setBlock(e.target.value); setMyPlot(''); }} style={selectStyle}>
            <option value="">2. Select block…</option>
            {data.blocks.map((b) => (
              <option key={b.block} value={b.block}>Block {b.block} ({b.report_count})</option>
            ))}
          </select>
        )}
      </div>

      {societyKey && data?.state === 'NOT_COVERED' && (
        <p style={{ fontSize: '14px', color: 'var(--muted)' }}>
          No reports yet for this society.{' '}
          <Link href={reportHref} style={{ color: '#1a56db', fontWeight: 700 }}>
            Built here? Report what you found →
          </Link>
        </p>
      )}

      {summary && verdict && (
        <div
          style={{
            background: verdict.bg,
            border: `1.5px solid ${verdict.border}`,
            borderLeft: `8px solid ${verdict.color}`,
            borderRadius: '12px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px', color: verdict.color }}>
            {verdict.label}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.3, color: 'var(--fg, #111)' }}>{verdict.headline}</div>

          {summary.extra_cost_lac_median !== null ? (
            <div style={{ fontSize: '15px' }}>
              <strong style={{ fontSize: '22px', color: verdict.color }}>~{summary.extra_cost_lac_median} Lac extra</strong>{' '}
              reported by owners ({summary.extra_cost_report_count} report{summary.extra_cost_report_count === 1 ? '' : 's'}).
              Add this to your budget if your plot behaves like its neighbours.
            </div>
          ) : (
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>No extra cost has been reported for this block yet.</div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Chip text={`${summary.deep_foundation_count} of ${summary.report_count} needed deep foundation`} />
            {summary.depth_ft_median !== null && <Chip text={`Typical depth ${summary.depth_ft_median} ft`} />}
            {summary.soil_test_count > 0 && <Chip text={`${summary.soil_test_count} backed by soil test`} />}
          </div>

          <PlotList plots={summary.plots ?? []} myPlot={myPlot} setMyPlot={setMyPlot} />

          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            Based on owner/builder reports reviewed by Siraat (confidence {Math.round(summary.confidence_score * 100)}%
            {summary.state === 'DEGRADED_SUCCESS' ? ', few reports so far' : ''}
            {summary.is_stale ? ', older reports' : ''}). An indicator, not a soil test: get a geotechnical test for your own
            plot before you build.
          </p>
        </div>
      )}

      {societyKey && (
        <Link
          href={reportHref}
          style={{
            alignSelf: 'flex-start',
            fontSize: '14px',
            fontWeight: 700,
            color: '#fff',
            background: '#1a56db',
            borderRadius: '10px',
            padding: '10px 16px',
            textDecoration: 'none',
          }}
        >
          Built here? Add your report
        </Link>
      )}
    </section>
  );
}

const CONDITION_LABEL: Record<string, { text: string; color: string }> = {
  SOLID: { text: 'Solid ground', color: '#15803d' },
  FILLED: { text: 'Filled land', color: '#b91c1c' },
  MIXED: { text: 'Mixed', color: '#b45309' },
};
const FOUNDATION_LABEL: Record<string, string> = {
  STANDARD: 'Standard foundation',
  RAFT: 'Raft foundation',
  DEEP_STRIP: 'Deep strip foundation',
  PILING: 'Piling',
};

function PlotList({ plots, myPlot, setMyPlot }: { plots: GroundPlotReport[]; myPlot: string; setMyPlot: (v: string) => void }) {
  if (plots.length === 0) return null;
  const q = myPlot.trim().toLowerCase();
  const match = q ? plots.filter((p) => (p.plot_number ?? '').toLowerCase() === q) : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800 }}>Reports by plot number</div>
      <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
        Ground can differ from one plot to the next, even in the same block. Compare with plots close to yours.
      </p>
      <input
        aria-label="Your plot number"
        value={myPlot}
        onChange={(e) => setMyPlot(e.target.value)}
        placeholder="Enter your plot number to check"
        style={{ padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '10px', fontSize: '14px', maxWidth: '280px' }}
      />
      {q && match.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          No report for plot {myPlot.trim()} yet. Use the nearby plots below as a guide only.
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {plots.map((p, i) => {
          const c = CONDITION_LABEL[p.ground_condition] ?? CONDITION_LABEL.MIXED;
          const mine = q !== '' && (p.plot_number ?? '').toLowerCase() === q;
          return (
            <div
              key={`${p.plot_number ?? 'x'}-${i}`}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: mine ? '#eff6ff' : '#fff',
                border: mine ? '2px solid #1a56db' : '1px solid var(--border)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '13px',
              }}
            >
              <strong style={{ fontSize: '15px', minWidth: '84px' }}>
                Plot {p.plot_number ?? 'not given'}
              </strong>
              <span style={{ color: c.color, fontWeight: 700 }}>{c.text}</span>
              <span>{FOUNDATION_LABEL[p.foundation_type] ?? p.foundation_type}</span>
              {p.foundation_depth_ft !== null && <span>{p.foundation_depth_ft} ft deep</span>}
              {p.extra_cost_lac !== null && <span style={{ fontWeight: 700 }}>+{p.extra_cost_lac} Lac</span>}
              {p.soil_test_done && <span style={{ color: 'var(--muted)' }}>soil tested</span>}
              {p.build_year !== null && <span style={{ color: 'var(--muted)' }}>{p.build_year}</span>}
              {mine && <span style={{ color: '#1a56db', fontWeight: 800 }}>Your plot</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, background: '#fff', border: '1px solid var(--border)', borderRadius: '99px', padding: '4px 10px' }}>
      {text}
    </span>
  );
}

function groundVerdict(s: GroundBlockSummary) {
  const ratio = s.report_count > 0 ? s.deep_foundation_count / s.report_count : 0;
  const few = s.report_count < 3 ? ' (few reports so far)' : '';
  if (ratio === 0)
    return { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0', label: 'LOW RISK', headline: `Normal foundation reported${few}` };
  if (ratio < 0.5)
    return { color: '#b45309', bg: '#fffbeb', border: '#fde68a', label: 'MEDIUM RISK', headline: `Some plots here needed a deeper foundation${few}` };
  return { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', label: 'HIGH RISK', headline: `Most plots here needed deep foundation or piling${few}` };
}
