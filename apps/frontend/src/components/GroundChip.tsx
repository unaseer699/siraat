import Link from 'next/link';
import type { GroundBlockSummary } from '@siraat/shared-types';

const RISK: Record<NonNullable<GroundBlockSummary['reported_risk']>, { label: string; color: string; bg: string }> = {
  LOWER: { label: 'Lower reported risk', color: '#166534', bg: '#f0fdf4' },
  MODERATE: { label: 'Moderate reported risk', color: '#92400e', bg: '#fffbeb' },
  HIGHER: { label: 'Higher reported risk', color: '#991b1b', bg: '#fef2f2' },
};

// What owners/builders in a block actually reported underground. An indicator
// built from reviewed reports — never a verification of any individual plot.
export function GroundChip({
  summary,
  societyName,
  block,
}: {
  summary: GroundBlockSummary | undefined;
  societyName: string;
  block: string;
}) {
  const reportHref = `/report-ground?society=${encodeURIComponent(societyName)}&block=${encodeURIComponent(block)}`;

  if (!summary) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
        No ground reports yet for this block.{' '}
        <Link href={reportHref} style={{ color: '#1a56db', fontWeight: 600 }}>
          Built here? Report what you found →
        </Link>
      </p>
    );
  }

  const risk = summary.reported_risk ? RISK[summary.reported_risk] : null;
  const parts = [
    `${summary.report_count} report${summary.report_count === 1 ? '' : 's'}`,
    `${summary.deep_foundation_count} needed deep foundations`,
    summary.filled_count > 0 ? `${summary.filled_count} filled ground` : null,
    summary.depth_ft_median !== null ? `typical depth ${summary.depth_ft_median} ft` : null,
    summary.extra_cost_lac_median !== null ? `extra foundation cost ~${summary.extra_cost_lac_median} Lac` : null,
    summary.evidence_report_count > 0 ? `${summary.evidence_report_count} with photos/documents` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
      {risk && (
        <span style={{ padding: '3px 10px', borderRadius: '999px', fontWeight: 700, color: risk.color, background: risk.bg }}>
          {risk.label}
        </span>
      )}
      <span style={{ color: 'var(--text)' }}>{parts.join(' · ')}</span>
      {(summary.state === 'DEGRADED_SUCCESS' || summary.is_stale) && (
        <span style={{ color: 'var(--muted)' }}>
          ({summary.is_stale ? 'older reports' : 'few reports so far'} — confidence {Math.round(summary.confidence_score * 100)}%)
        </span>
      )}
      <Link href={reportHref} style={{ color: '#1a56db', fontWeight: 600 }}>
        Add yours →
      </Link>
      {summary.affiliation_disclosure && <span style={{ color: 'var(--muted)' }}>{summary.affiliation_disclosure}</span>}
    </div>
  );
}
