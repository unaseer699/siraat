import type { RecommendationResponse } from '@siraat/shared-types';
import { RecommendationCard } from './RecommendationCard';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

interface Props {
  result: RecommendationResponse;
}

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  FULL: { label: 'Full Coverage', color: 'var(--success)' },
  DEGRADED_SUCCESS: { label: 'Limited Data', color: 'var(--warn)' },
  NOT_COVERED: { label: 'Not Covered', color: 'var(--error)' },
};

export function ResultsPanel({ result }: Props) {
  const { label, color } = STATE_LABELS[result.state] ?? STATE_LABELS.FULL;

  return (
    <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color,
            background: `${color}18`,
            padding: '2px 10px',
            borderRadius: '99px',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
          {result.recommendations.length} result{result.recommendations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {result.state === 'NOT_COVERED' && (
        <div
          style={{
            padding: '16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius)',
            color: 'var(--error)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <span>{'message' in result ? result.message : 'This area is not yet covered.'}</span>
          {'demand_count' in result && result.demand_count !== null && result.demand_count > 0 && (
            <span style={{ fontSize: '13px', opacity: 0.8 }}>
              {`You're the ${result.demand_count}${ordinal(result.demand_count)} person to search for this area.`}
            </span>
          )}
        </div>
      )}

      {result.state === 'DEGRADED_SUCCESS' && 'missing_evidence' in result && result.missing_evidence.length > 0 && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius)',
            fontSize: '13px',
            color: 'var(--warn)',
          }}
        >
          Missing evidence: {result.missing_evidence.join(', ')}
        </div>
      )}

      {result.recommendations.map((rec) => (
        <RecommendationCard key={rec.id} rec={rec} />
      ))}
    </div>
  );
}
