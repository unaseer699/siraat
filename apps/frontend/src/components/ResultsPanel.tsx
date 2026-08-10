'use client';

import Link from 'next/link';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { RecommendationResponse, RecommendationItem } from '@siraat/shared-types';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED } from '../styles/tokens';

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

function confidenceColor(score: number): string {
  return score >= 0.8 ? TRUST_GREEN : score >= 0.5 ? WARNING_AMBER : DANGER_RED;
}

function ConfidenceGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = confidenceColor(score);

  return (
    <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
      <RadialBarChart
        width={90}
        height={90}
        cx={45}
        cy={45}
        innerRadius={30}
        outerRadius={44}
        barSize={14}
        data={[{ value: pct, fill: color }]}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={7} background={{ fill: '#e5e7eb' }} />
      </RadialBarChart>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 800, color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600, marginTop: '2px' }}>trust</span>
      </div>
    </div>
  );
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  FULL: { label: 'Full Coverage', color: TRUST_GREEN, bg: `${TRUST_GREEN}18` },
  DEGRADED_SUCCESS: { label: 'Limited Data', color: WARNING_AMBER, bg: `${WARNING_AMBER}18` },
  NOT_COVERED: { label: 'Not Covered', color: DANGER_RED, bg: `${DANGER_RED}18` },
};

interface Props {
  result: RecommendationResponse;
}

function RecCard({ rec }: { rec: RecommendationItem }) {
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

export function ResultsPanel({ result }: Props) {
  const meta = STATE_META[result.state] ?? STATE_META.FULL;

  return (
    <div style={{ width: '100%', maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
        <RecCard key={rec.id} rec={rec} />
      ))}
    </div>
  );
}
