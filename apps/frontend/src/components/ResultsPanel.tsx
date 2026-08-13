'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RecommendationResponse, RecommendationItem } from '@siraat/shared-types';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED } from '../styles/tokens';
import { ConfidenceGauge } from './ConfidenceGauge';

const MAX_COMPARE = 3;

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  FULL: { label: 'Full Coverage', color: TRUST_GREEN, bg: `${TRUST_GREEN}18` },
  DEGRADED_SUCCESS: { label: 'Limited Data', color: WARNING_AMBER, bg: `${WARNING_AMBER}18` },
  NOT_COVERED: { label: 'Not Covered', color: DANGER_RED, bg: `${DANGER_RED}18` },
};

interface Props {
  result: RecommendationResponse;
  compareSelection: RecommendationItem[];
  onToggleCompare: (item: RecommendationItem) => void;
}

function RecCard({
  rec,
  isSelected,
  isCapped,
  onToggleCompare,
}: {
  rec: RecommendationItem;
  isSelected: boolean;
  isCapped: boolean;
  onToggleCompare: (item: RecommendationItem) => void;
}) {
  return (
    <article
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{rec.title}</h3>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          {rec.society_name}
          {rec.is_stale && (
            <span style={{ marginLeft: '8px', color: WARNING_AMBER, fontSize: '12px' }}>
              ⚠ Stale (&gt;{rec.staleness_threshold_days}d)
            </span>
          )}
        </p>
        <p style={{ fontSize: '20px', fontWeight: 700 }}>{formatPKR(rec.price)}</p>
        <p style={{ fontSize: '14px', color: 'var(--text)' }}>{rec.recommendation_summary}</p>
        {rec.affiliation_disclosure && (
          <p
            style={{
              fontSize: '12px',
              color: WARNING_AMBER,
              borderLeft: `3px solid ${WARNING_AMBER}`,
              paddingLeft: '8px',
            }}
          >
            Disclosure: {rec.affiliation_disclosure}
          </p>
        )}
        <label
          title={
            isCapped
              ? 'You can compare up to 3 societies — remove one to add another.'
              : undefined
          }
          style={{
            marginTop: '2px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: isCapped ? 'var(--muted)' : 'var(--text)',
            cursor: isCapped ? 'not-allowed' : 'pointer',
            width: 'fit-content',
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isCapped}
            onChange={() => onToggleCompare(rec)}
          />
          Add to compare
        </label>
        <div style={{ marginTop: '4px' }}>
          <Link
            href={`/recommendation/${rec.id}`}
            style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)' }}
          >
            Why this recommendation? →
          </Link>
        </div>
      </div>
      <ConfidenceGauge score={rec.confidence_score} />
    </article>
  );
}

export function ResultsPanel({ result, compareSelection, onToggleCompare }: Props) {
  const router = useRouter();
  const meta = STATE_META[result.state] ?? STATE_META.FULL;
  const selectedIds = new Set(compareSelection.map((c) => c.society_id));
  const canCompare = compareSelection.length >= 2;

  function handleCompareClick() {
    const ids = compareSelection.map((c) => c.society_id).join(',');
    router.push(`/compare?ids=${encodeURIComponent(ids)}`);
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '680px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        paddingBottom: canCompare ? '64px' : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: meta.color,
            background: meta.bg,
            padding: '2px 10px',
            borderRadius: '99px',
          }}
        >
          {meta.label}
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
            border: `1px solid ${DANGER_RED}40`,
            borderRadius: 'var(--radius)',
            color: DANGER_RED,
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

      {result.state === 'DEGRADED_SUCCESS' &&
        'missing_evidence' in result &&
        result.missing_evidence.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fffbeb',
              border: `1px solid ${WARNING_AMBER}60`,
              borderRadius: 'var(--radius)',
              fontSize: '13px',
              color: WARNING_AMBER,
            }}
          >
            Missing evidence: {result.missing_evidence.join(', ')}
          </div>
        )}

      {result.recommendations.map((rec) => (
        <RecCard
          key={rec.id}
          rec={rec}
          isSelected={selectedIds.has(rec.society_id)}
          isCapped={!selectedIds.has(rec.society_id) && compareSelection.length >= MAX_COMPARE}
          onToggleCompare={onToggleCompare}
        />
      ))}

      {canCompare && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
        >
          <button
            onClick={handleCompareClick}
            style={{
              padding: '12px 24px',
              background: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            }}
          >
            Compare Selected ({compareSelection.length}) →
          </button>
        </div>
      )}
    </div>
  );
}
