import type { ScoreBreakdown } from '@siraat/shared-types';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY, RADIUS } from '../styles/tokens';

interface Props {
  breakdown: ScoreBreakdown | null;
}

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

export function toneColor(tone: Tone): string {
  return tone === 'success'
    ? TRUST_GREEN
    : tone === 'warning'
      ? WARNING_AMBER
      : tone === 'danger'
        ? DANGER_RED
        : NEUTRAL_GRAY;
}

export function toneIcon(tone: Tone): string {
  return tone === 'success' ? '✓' : tone === 'warning' ? '⚠' : '—';
}

// Exported so other views (e.g. the Comparison table) can render the same four
// categories with the same tone/label logic instead of reimplementing it.
export const SCORE_BREAKDOWN_ROWS: {
  key: keyof ScoreBreakdown;
  category: string;
  label: (b: ScoreBreakdown) => string;
  tone: (b: ScoreBreakdown) => Tone;
}[] = [
  {
    key: 'regulatory',
    category: 'Regulatory Status',
    label: (b) => b.regulatory.label,
    tone: (b) => b.regulatory.tone,
  },
  {
    key: 'active_issues',
    category: 'Active Issues',
    label: (b) => b.active_issues.label,
    tone: (b) => b.active_issues.tone,
  },
  {
    key: 'evidence_strength',
    category: 'Evidence Strength',
    label: (b) => b.evidence_strength.label,
    tone: (b) => b.evidence_strength.tone,
  },
  {
    key: 'data_freshness',
    category: 'Data Freshness',
    label: (b) => b.data_freshness.checked_date,
    tone: (b) => b.data_freshness.tone,
  },
];

export function ScoreBreakdown({ breakdown }: Props) {
  if (!breakdown) {
    return (
      <p style={{ fontSize: '13px', color: NEUTRAL_GRAY }}>
        Breakdown not available for this score.
      </p>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>Score breakdown</h2>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SCORE_BREAKDOWN_ROWS.map((row) => {
          const tone = row.tone(breakdown);
          const color = toneColor(tone);
          return (
            <li
              key={row.key}
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
              <span style={{ color, fontSize: '16px', flexShrink: 0, fontWeight: 700, width: '16px', textAlign: 'center' }}>
                {toneIcon(tone)}
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
                  {row.category}
                </div>
                <div style={{ fontSize: '13px', color: '#111827', marginTop: '2px' }}>
                  {row.label(breakdown)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
