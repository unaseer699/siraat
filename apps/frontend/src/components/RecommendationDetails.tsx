'use client';

import Link from 'next/link';
import type { RecommendationDetail, EvidenceSummary } from '@siraat/shared-types';
import StatCard from './StatCard';
import { ScoreBreakdown } from './ScoreBreakdown';
import { ConfidenceGauge } from './ConfidenceGauge';
import { CopyLinkButton } from './CopyLinkButton';
import { DownloadReportButton } from './DownloadReportButton';
import { BackLink } from './BackLink';
import { TRUST_GREEN, WARNING_AMBER, RADIUS } from '../styles/tokens';

interface Props {
  detail: RecommendationDetail;
}

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

const TYPE_LABEL: Record<EvidenceSummary['type'], string> = {
  document: 'Document',
  photo: 'Photo',
  receipt: 'Receipt',
  inspection_report: 'Inspection Report',
};

function EvidenceCited({
  summaries,
  fallbackIds,
}: {
  summaries: EvidenceSummary[];
  fallbackIds: string[];
}) {
  const hasSummaries = summaries.length > 0;
  const count = hasSummaries ? summaries.length : fallbackIds.length;

  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
        Evidence cited ({count})
      </h2>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {hasSummaries
          ? summaries.map((e) => (
              <li
                key={e.id}
                style={{
                  padding: '12px 16px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: RADIUS.md,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ color: TRUST_GREEN, fontSize: '16px', flexShrink: 0, fontWeight: 700 }}>
                  ✓
                </span>
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {TYPE_LABEL[e.type]}
                  </div>
                  <div style={{ fontSize: '13px', color: '#111827', marginTop: '2px' }}>
                    {e.source_ref}
                  </div>
                </div>
              </li>
            ))
          : fallbackIds.map((id) => (
              <li
                key={id}
                style={{
                  padding: '12px 16px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: RADIUS.md,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={{ color: TRUST_GREEN, fontSize: '16px', flexShrink: 0, fontWeight: 700 }}>
                  ✓
                </span>
                <div style={{ fontSize: '13px', color: '#111827', fontFamily: 'monospace' }}>{id}</div>
              </li>
            ))}
      </ul>
    </div>
  );
}

export function RecommendationDetails({ detail }: Props) {
  const computedDate = new Date(detail.computed_at).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const evidenceCount =
    detail.evidence_summaries.length > 0
      ? detail.evidence_summaries.length
      : detail.derived_from.length;

  const evidenceTone =
    evidenceCount >= 3 ? 'success' : evidenceCount >= 1 ? 'neutral' : 'danger';

  const confidenceTone =
    detail.confidence_score >= 0.8
      ? 'success'
      : detail.confidence_score >= 0.5
        ? 'warning'
        : 'danger';

  return (
    <article
      style={{
        maxWidth: '680px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <BackLink />

      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{detail.title}</h1>
        <Link
          href={`/society/${detail.society_id}`}
          style={{ color: 'var(--muted)', marginTop: '4px', display: 'inline-block' }}
        >
          {detail.society_name}
        </Link>
        <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>
          {formatPKR(detail.price)}
        </p>
        {detail.is_stale && (
          <p style={{ color: WARNING_AMBER, fontSize: '13px', marginTop: '4px' }}>
            ⚠ Data may be stale (threshold: {detail.staleness_threshold_days} days)
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <CopyLinkButton />
        <DownloadReportButton recommendationId={detail.id} />
      </div>

      {detail.affiliation_disclosure && (
        <div
          style={{
            padding: '14px 16px',
            background: '#fffbeb',
            border: '2px solid #f59e0b',
            borderRadius: 'var(--radius)',
          }}
        >
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
            AFFILIATION DISCLOSURE
          </p>
          <p style={{ fontSize: '14px', color: '#78350f' }}>{detail.affiliation_disclosure}</p>
        </div>
      )}

      <div
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <ConfidenceGauge score={detail.confidence_score} size="lg" />

        <ScoreBreakdown breakdown={detail.breakdown} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <StatCard
            value={evidenceCount}
            label="Evidence cited"
            tone={evidenceTone}
            icon="📄"
          />
          <StatCard
            value={computedDate}
            label="Last verified"
            tone={detail.is_stale ? 'warning' : confidenceTone}
            icon="🗓"
          />
        </div>

        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
            Why Siraat recommends this
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>
            {detail.reasoning_summary}
          </p>
        </div>

        <EvidenceCited summaries={detail.evidence_summaries} fallbackIds={detail.derived_from} />

        <p
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            borderTop: '1px solid var(--border)',
            paddingTop: '12px',
          }}
        >
          Score computed on {computedDate} · record_type: {detail.record_type}
        </p>
      </div>
    </article>
  );
}
