import type { RecommendationItem } from '@siraat/shared-types';

interface Props {
  rec: RecommendationItem;
}

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

export function RecommendationCard({ rec }: Props) {
  const confidencePct = Math.round(rec.confidence_score * 100);
  const confidenceColor = rec.confidence_score >= 0.8 ? 'var(--success)' : rec.confidence_score >= 0.5 ? 'var(--warn)' : 'var(--error)';

  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{rec.title}</h3>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: confidenceColor,
            background: `${confidenceColor}18`,
            padding: '2px 8px',
            borderRadius: '99px',
            whiteSpace: 'nowrap',
          }}
        >
          {confidencePct}% confidence
        </span>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
        {rec.society_name}
        {rec.is_stale && (
          <span style={{ marginLeft: '8px', color: 'var(--warn)', fontSize: '12px' }}>
            ⚠ Stale data (&gt;{rec.staleness_threshold_days}d)
          </span>
        )}
      </p>

      <p style={{ fontSize: '20px', fontWeight: 700 }}>{formatPKR(rec.price)}</p>

      <p style={{ fontSize: '14px', color: 'var(--text)' }}>{rec.recommendation_summary}</p>

      {rec.affiliation_disclosure && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--warn)',
            borderLeft: '3px solid var(--warn)',
            paddingLeft: '8px',
          }}
        >
          Disclosure: {rec.affiliation_disclosure}
        </p>
      )}
    </article>
  );
}
