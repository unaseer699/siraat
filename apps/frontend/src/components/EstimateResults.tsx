'use client';

import Link from 'next/link';
import type { BoqResponse, BoqLineItem, MaterialRateSourceTier } from '@siraat/shared-types';
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

function formatQuantity(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  if (tier === 'MARKET_REFERENCE' || tier === 'FIELD_REPORTED') {
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
        {tier === 'FIELD_REPORTED' ? 'Field Reported' : 'Market Reference'}
      </span>
    );
  }
  return null;
}

// Excavation and Paint quantities come from generic geometric approximations
// (see computeExcavationCft / computePaintLiters in boq-catalog.ts), not a
// Pakistan-specific published ratio. The caveat therefore sits on the row itself.
const APPROXIMATION_CAVEATS: Partial<Record<string, string>> = {
  EXCAVATION:
    'Approximate: assumes a square plot and a footing depth set by floor count, using generic engineering figures (not a Pakistan-specific standard). Confirm depth with a structural engineer or soil report before hiring excavation.',
  PAINT:
    'Approximate: assumes wall area of about 3.2× floor area and coverage of about 110 sq ft per liter, both generic figures (not Pakistan-specific). Confirm with your painter against your actual plan.',
};

const BASEMENT_EXCAVATION_CAVEAT =
  'Basement: does not include extra digging around the basement walls for shuttering and waterproofing, so the real volume will be higher.';

function ApproximationCaveat({ text }: { text: string }) {
  return (
    <span
      style={{
        fontSize: '12px',
        color: '#92400e',
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: '6px',
        padding: '4px 8px',
        maxWidth: '260px',
      }}
    >
      ⚠ {text}
    </span>
  );
}

function BoqTable({ lineItems, basement }: { lineItems: BoqLineItem[]; basement: boolean }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: RADIUS.md, border: '1px solid #e5e7eb' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '760px' }}>
        <thead>
          <tr>
            <th style={headCellStyle}>Item</th>
            <th style={headCellStyle}>Unit</th>
            <th style={headCellStyle}>Estimated Quantity</th>
            <th style={headCellStyle}>Rate</th>
            <th style={headCellStyle}>Line Total</th>
            <th style={headCellStyle}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item) => (
            <tr key={item.item_key}>
              <td style={{ ...cellStyle, fontWeight: 600 }}>
                {item.item_name}
                {item.is_major && (
                  <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>
                    MAJOR
                  </span>
                )}
              </td>
              <td style={cellStyle}>{item.unit}</td>
              <td style={cellStyle}>
                {item.quantity !== null ? (
                  formatQuantity(item.quantity)
                ) : (
                  <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Not available</span>
                )}
              </td>
              <td style={cellStyle}>
                {!item.available ? (
                  '—'
                ) : item.unit_rate !== null ? (
                  formatPKR(item.unit_rate)
                ) : (
                  <span style={{ color: 'var(--muted)' }}>Rate not yet available</span>
                )}
              </td>
              <td style={{ ...cellStyle, fontWeight: 600 }}>
                {item.subtotal !== null ? formatPKR(item.subtotal) : '—'}
              </td>
              <td style={cellStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                  {item.notes && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: '260px' }}>{item.notes}</span>
                  )}
                  {APPROXIMATION_CAVEATS[item.item_key] && (
                    <ApproximationCaveat text={APPROXIMATION_CAVEATS[item.item_key]!} />
                  )}
                  {item.item_key === 'EXCAVATION' && basement && (
                    <ApproximationCaveat text={BASEMENT_EXCAVATION_CAVEAT} />
                  )}
                  {item.available && item.unit_rate !== null && (
                    <>
                      <SourceTierBadge tier={item.source_tier} />
                      {item.source_name && (
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.source_name}</span>
                      )}
                      {item.recorded_date && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>as of {item.recorded_date}</span>
                      )}
                    </>
                  )}
                  {/* Staleness describes a rate, so it only shows when a rate is shown. */}
                  {item.available && item.unit_rate !== null && item.is_stale && (
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

function AssumptionsBlock({ result }: { result: Extract<BoqResponse, { state: 'FULL' | 'DEGRADED_SUCCESS' }> }) {
  return (
    <div
      style={{
        padding: '16px',
        background: '#f9fafb',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        fontSize: '13px',
        color: '#374151',
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: '8px' }}>Assumptions</p>
      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <li>Quantities based on standard ratios for the selected finish level ({result.finish_level}).</li>
        <li>Standard wastage is included in the ratios used, where applicable.</li>
        <li>
          A basement adds a full-footprint dig to basement depth, with the footing trench starting at the basement
          floor (included in the Excavation line above). Digging for working space around the basement walls is not
          included.
        </li>
        <li>All quantities are calculated using 1 marla = 225 sq ft.</li>
        <li>Rates (when shown) include their &quot;as of&quot; date.</li>
        <li>
          Excavation and Paint quantities use a geometric approximation with generic engineering/architectural
          assumptions (not a Pakistan-specific published standard) — verify excavation depth with a structural
          engineer or soil report before purchasing.
        </li>
        <li>
          Items marked &quot;Not available&quot; have no standard planning-stage quantity ratio in any source found
          for Pakistani residential construction — see each item&apos;s Notes.
        </li>
      </ul>
    </div>
  );
}

interface Props {
  result: BoqResponse;
}

export function EstimateResults({ result }: Props) {
  const meta = STATE_META[result.state] ?? STATE_META.FULL;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '900px',
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
                {result.state === 'FULL' ? 'Total estimate' : 'Partial total – some rates missing'}
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
                  {result.missing_major_items.length > 0 && (
                    <p style={{ fontSize: '13px', color: WARNING_AMBER, marginTop: '6px' }}>
                      Missing rates for: {result.missing_major_items.join(', ')} — not included in this figure.
                    </p>
                  )}
                </>
              )}
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
                {result.area} {result.area_unit === 'MARLA' ? 'Marla' : 'sq ft'} ({result.area_sqft.toLocaleString()}{' '}
                sq ft total) · {result.floors} floor{result.floors > 1 ? 's' : ''}
                {result.basement ? ' + basement' : ''} · {result.finish_level}
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

          <BoqTable lineItems={result.line_items} basement={result.basement} />

          <AssumptionsBlock result={result} />

          {/* CONTRACTOR DIRECTORY Chunk 3 — pre-filtered to the grey-structure
              trade this estimate covers (excavation/masonry/steel/shuttering
              are separate trades; MASON_GREY_STRUCTURE is the representative one). */}
          <Link
            href="/contractors?trade=MASON_GREY_STRUCTURE"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            Need help building this? Find verified contractors →
          </Link>

          {/* SUPPLIER DIRECTORY Chunk 3 — unfiltered, since this estimate spans
              multiple material categories, not just one. */}
          <Link
            href="/suppliers"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            Need materials? Find verified suppliers →
          </Link>

          {/* HOUSE PLANS DIRECTORY Chunk 2 — cross-sell entry point: someone who
              just priced a BOQ may not have a design yet. */}
          <Link
            href="/house-plans"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            Have a plot? Browse house plans →
          </Link>
        </>
      )}
    </div>
  );
}
