'use client';

import type { EstimateResponse, EstimateLineItem, MaterialRateSourceTier } from '@siraat/shared-types';
import { ConfidenceGauge } from './ConfidenceGauge';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY, RADIUS } from '../styles/tokens';

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

const headCellStyle = {
  padding: '10px 14px',
  fontSize: '11px',
  fontWeight: 700,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  textAlign: 'left' as const,
  background: '#f9fafb',
  borderBottom: '2px solid #e5e7eb',
  whiteSpace: 'nowrap' as const,
};

const cellStyle = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#111827',
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'middle' as const,
};

// "Not the same visual weight as verified data" — a filled green pill for supplier-
// verified rates, versus a plain outlined gray label for market-reference ones.
function SourceTierBadge({ tier }: { tier: MaterialRateSourceTier | null }) {
  if (tier === 'SUPPLIER_VERIFIED') {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 700,
          color: TRUST_GREEN,
          background: `${TRUST_GREEN}18`,
          padding: '2px 10px',
          borderRadius: '99px',
        }}
      >
        Supplier Verified
      </span>
    );
  }
  if (tier === 'MARKET_REFERENCE') {
    return (
      <span
        style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 600,
          color: NEUTRAL_GRAY,
          border: `1px solid ${NEUTRAL_GRAY}50`,
          padding: '1px 9px',
          borderRadius: '99px',
        }}
      >
        Market Reference
      </span>
    );
  }
  return <span style={{ fontSize: '12px', color: NEUTRAL_GRAY }}>—</span>;
}

function LineItemsTable({ lineItems }: { lineItems: EstimateLineItem[] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: RADIUS.md, border: '1px solid #e5e7eb' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '640px' }}>
        <thead>
          <tr>
            <th style={headCellStyle}>Material</th>
            <th style={headCellStyle}>Quantity</th>
            <th style={headCellStyle}>Rate</th>
            <th style={headCellStyle}>Subtotal</th>
            <th style={headCellStyle}>Source</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.material_key}>
              <td style={{ ...cellStyle, fontWeight: 600 }}>{item.material_name}</td>
              <td style={cellStyle}>
                {item.quantity} {item.unit}
              </td>
              <td style={cellStyle}>{item.unit_rate !== null ? formatPKR(item.unit_rate) : '—'}</td>
              <td style={{ ...cellStyle, fontWeight: 600 }}>
                {item.subtotal !== null ? formatPKR(item.subtotal) : '—'}
              </td>
              <td style={cellStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                  <SourceTierBadge tier={item.source_tier} />
                  {item.source_name && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.source_name}</span>
                  )}
                  {item.is_stale && (
                    <span style={{ fontSize: '11px', color: WARNING_AMBER, fontWeight: 600 }}>
                      ⚠ Stale{item.recorded_date ? ` (as of ${item.recorded_date})` : ''}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  result: EstimateResponse;
}

export function EstimateResults({ result }: Props) {
  const meta = STATE_META[result.state] ?? STATE_META.FULL;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '760px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
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
        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>{result.city}</span>
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
          <span>{result.message}</span>
          {result.demand_count !== null && result.demand_count > 0 && (
            <span style={{ fontSize: '13px', opacity: 0.8 }}>
              {`You're the ${result.demand_count}${ordinal(result.demand_count)} person to ask for an estimate here.`}
            </span>
          )}
        </div>
      )}

      {(result.state === 'FULL' || result.state === 'DEGRADED_SUCCESS') && (
        <>
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                {result.state === 'FULL' ? 'Total estimate' : 'Partial total (incomplete)'}
              </p>
              {result.state === 'FULL' ? (
                <p style={{ fontSize: '32px', fontWeight: 800, marginTop: '4px' }}>
                  {formatPKR(result.total_estimate)}
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '32px', fontWeight: 800, marginTop: '4px', color: WARNING_AMBER }}>
                    {result.partial_subtotal !== null ? formatPKR(result.partial_subtotal) : '—'}
                  </p>
                  {result.missing_materials.length > 0 && (
                    <p style={{ fontSize: '13px', color: WARNING_AMBER, marginTop: '6px' }}>
                      Missing rates for: {result.missing_materials.join(', ')} — not included in this
                      figure.
                    </p>
                  )}
                </>
              )}
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
                {result.area_marla} Marla · {result.quality_tier}
              </p>
            </div>
            <ConfidenceGauge score={result.confidence_score} size="lg" />
          </div>

          {result.affiliation_disclosure && (
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
              <p style={{ fontSize: '14px', color: '#78350f' }}>{result.affiliation_disclosure}</p>
            </div>
          )}

          <LineItemsTable lineItems={result.line_items} />
        </>
      )}
    </div>
  );
}
