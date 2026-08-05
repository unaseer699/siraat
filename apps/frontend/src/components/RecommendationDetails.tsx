import Link from 'next/link';
import type { RecommendationDetail, EvidenceSummary } from '@siraat/shared-types';

interface Props {
  detail: RecommendationDetail;
}

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8 ? 'var(--success)' : score >= 0.5 ? 'var(--warn)' : 'var(--error)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
        <span style={{ fontWeight: 600 }}>Trust confidence</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div
        style={{
          height: '8px',
          background: 'var(--border)',
          borderRadius: '99px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: '99px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
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
  const count = summaries.length > 0 ? summaries.length : fallbackIds.length;
  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
        Evidence cited ({count})
      </h2>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {summaries.length > 0
          ? summaries.map((e) => (
              <li
                key={e.id}
                style={{
                  fontSize: '13px',
                  color: 'var(--text)',
                  padding: '8px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}
                >
                  {TYPE_LABEL[e.type]}
                </span>
                <span>{e.source_ref}</span>
              </li>
            ))
          : fallbackIds.map((id) => (
              <li
                key={id}
                style={{
                  fontSize: '13px',
                  color: 'var(--text)',
                  padding: '6px 10px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                }}
              >
                {id}
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
      <Link href="/" style={{ fontSize: '14px', color: 'var(--muted)' }}>
        ← Back to search
      </Link>

      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{detail.title}</h1>
        <p style={{ color: 'var(--muted)', marginTop: '4px' }}>{detail.society_name}</p>
        <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>
          {formatPKR(detail.price)}
        </p>
        {detail.is_stale && (
          <p style={{ color: 'var(--warn)', fontSize: '13px', marginTop: '4px' }}>
            ⚠ Data may be stale (threshold: {detail.staleness_threshold_days} days)
          </p>
        )}
      </div>

      {/* Affiliation disclosure — visually prominent, never buried */}
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
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <ConfidenceBar score={detail.confidence_score} />

        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
            Why Siraat recommends this
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>
            {detail.reasoning_summary}
          </p>
        </div>

        <EvidenceCited summaries={detail.evidence_summaries} fallbackIds={detail.derived_from} />

        <p style={{ fontSize: '12px', color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          Score computed on {computedDate} · record_type: {detail.record_type}
        </p>
      </div>
    </article>
  );
}
