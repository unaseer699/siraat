'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import type { BoqResponse, BoqLineItem } from '@siraat/shared-types';
import { ConfidenceGauge } from './ConfidenceGauge';
import { SourceTierBadge } from './SourceTierBadge';
import { PHASE_BY_KEY, PHASE_STYLES, BOQ_ITEM_PHASE } from '../lib/buildPhases';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, RADIUS } from '../styles/tokens';

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

// SourceTierBadge moved to components/SourceTierBadge.tsx — see that file's
// comment (UI REVIEW finding: this was duplicated in 3 places).

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

const BOQ_CSS = `
.est-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;width:100%}
.est-col{display:flex;flex-direction:column;gap:14px;min-width:0}
@media(min-width:1100px){.est-layout{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start;gap:20px}}
.boq-phase{border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;background:#fff}
.boq-row{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:12px 14px;border-top:1px solid #eef0f3}
.boq-name{font-weight:700;font-size:14px;color:#111827}
.boq-total{font-weight:800;font-size:15px;color:#111827;text-align:right;white-space:nowrap}
.boq-math{grid-column:1 / -1;font-size:13px;color:#4b5563}
.boq-det{grid-column:1 / -1;margin-top:4px}
.boq-det summary{cursor:pointer;font-size:12px;font-weight:600;color:#2563eb;list-style:none}
.boq-det summary::-webkit-details-marker{display:none}
.boq-det-body{display:flex;flex-direction:column;gap:6px;align-items:flex-start;margin-top:6px}
`;

function BoqList({ lineItems, basement }: { lineItems: BoqLineItem[]; basement: boolean }) {
  // Lines grouped under the build step they belong to, in site order.
  const sections = PHASE_STYLES.map((p) => ({
    phaseKey: p.key,
    items: lineItems.filter((li) => (BOQ_ITEM_PHASE[li.item_key] ?? 'GREY') === p.key),
  })).filter((x) => x.items.length > 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <style>{BOQ_CSS}</style>
      {sections.map(({ phaseKey, items }) => {
        const st = PHASE_BY_KEY[phaseKey];
        const stepTotal = items.reduce((sum, i) => sum + (i.subtotal ?? 0), 0);
        return (
          <section key={phaseKey} className="boq-phase" style={{ borderLeft: `6px solid ${st.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', background: st.tint, color: st.ink, fontWeight: 800, fontSize: '14px' }}>
              <span>Step {st.step} · {st.title}</span>
              {stepTotal > 0 && <span style={{ whiteSpace: 'nowrap' }}>{formatPKR(stepTotal)}</span>}
            </div>
            {items.map((item) => {
              const hasDetails =
                !!item.notes ||
                !!APPROXIMATION_CAVEATS[item.item_key] ||
                (item.available && item.unit_rate !== null);
              return (
                <div key={item.item_key} className="boq-row">
                  <div className="boq-name">
                    {item.item_name}
                    {item.is_major && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>MAJOR</span>}
                  </div>
                  <div className="boq-total">{item.subtotal !== null ? formatPKR(item.subtotal) : '—'}</div>
                  <div className="boq-math">
                    {item.quantity === null ? (
                      <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Quantity not available</span>
                    ) : (
                      <>
                        <strong>{formatQuantity(item.quantity)}</strong> {item.unit}
                        {item.available &&
                          (item.unit_rate !== null ? (
                            <> × {formatPKR(item.unit_rate)}</>
                          ) : (
                            <span style={{ color: WARNING_AMBER, fontWeight: 600 }}> · rate not yet available</span>
                          ))}
                      </>
                    )}
                  </div>
                  {hasDetails && (
                    <details className="boq-det">
                      <summary>Details and source</summary>
                      <div className="boq-det-body">
                        {item.notes && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.notes}</span>}
                        {APPROXIMATION_CAVEATS[item.item_key] && <ApproximationCaveat text={APPROXIMATION_CAVEATS[item.item_key]!} />}
                        {item.item_key === 'EXCAVATION' && basement && <ApproximationCaveat text={BASEMENT_EXCAVATION_CAVEAT} />}
                        {item.available && item.unit_rate !== null && (
                          <>
                            <SourceTierBadge tier={item.source_tier} />
                            {item.source_name && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.source_name}</span>}
                            {item.recorded_date && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>as of {item.recorded_date}</span>}
                            {item.is_stale && (
                              <span style={{ fontSize: '11px', color: WARNING_AMBER, fontWeight: 600 }}>
                                ⚠ Stale{item.recorded_date ? ` (as of ${item.recorded_date})` : ''}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

type WholeHouse = NonNullable<Extract<BoqResponse, { state: 'FULL' }>['whole_house']>;

const ALLOWANCE_OPTIONS = [0, 5, 7.5, 10, 15];

function RoadmapCard({ w }: { w: WholeHouse }) {
  // Your own quotes for steps the estimate cannot price (plot, roof, ...), and
  // the contingency percentage. Kept in this page only, not saved.
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [allowancePct, setAllowancePct] = useState(5);
  const quoteOf = (key: string) => {
    const n = Number((quotes[key] ?? '').replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const yourQuotes = w.phases.filter((p) => p.basis === 'NOT_ESTIMATED' && p.key !== 'CONTINGENCY').reduce((sum, p) => sum + quoteOf(p.key), 0);
    // Contingency is a percentage of the building cost, and is part of the
  // whole-house figure shown at the top.
  const allowance = Math.round((w.total * allowancePct) / 100);
  const houseTotal = w.total + allowance;
  const allIn = houseTotal + w.before_building_total + yourQuotes;
  const scaled = w.phases.filter((p) => p.basis === 'SCALED' && p.amount !== null);
  const pct = (amount: number) => (w.total > 0 ? Math.round((amount / w.total) * 100) : 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
          Whole-house estimate (labour included, with {allowancePct}% contingency)
        </p>
        <p style={{ fontSize: '32px', fontWeight: 800 }}>{formatPKR(houseTotal)}</p>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Building cost {formatPKR(w.total)} + contingency {formatPKR(allowance)}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          About PKR {Math.round(houseTotal / Math.max(w.area_sqft + (w.basement_area_sqft ?? 0), 1)).toLocaleString()} per sq ft · {Math.round(w.area_sqft).toLocaleString()} sq ft covered{(w.basement_area_sqft ?? 0) > 0 ? ` + ${Math.round(w.basement_area_sqft ?? 0).toLocaleString()} sq ft basement` : ''} ·
          confidence {Math.round(w.confidence_score * 100)}%{w.is_stale ? ' · prices are not current' : ''}
        </p>
        <p style={{ fontSize: '13px' }}>
          Plus before building starts (approvals, soil testing, excavation, reference amounts):{' '}
          <strong>{formatPKR(w.before_building_total)}</strong>. The plot price is not included.
        </p>
        <div style={{ background: '#f9fafb', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', fontSize: '13px' }}>
          <strong>All-in estimate with approvals and your own quotes: {formatPKR(allIn)}</strong>
          <div style={{ color: 'var(--muted)', marginTop: '4px' }}>
            Whole house {formatPKR(houseTotal)} + approvals, soil and excavation {formatPKR(w.before_building_total)}
            {yourQuotes > 0 ? ` + your quotes ${formatPKR(yourQuotes)}` : ''}. Enter your own quotes in the steps marked &quot;Not estimated&quot; below.
          </div>
        </div>
        {/* Share of the building cost by step, in build order. */}
        <div style={{ display: 'flex', height: '14px', borderRadius: '99px', overflow: 'hidden', background: '#e5e7eb' }} aria-hidden="true">
          {scaled.map((p) => (
            <div key={p.key} title={`${p.title}: ${formatPKR(p.amount ?? 0)}`} style={{ width: `${(Math.max(p.amount ?? 0, 0) / Math.max(w.total, 1)) * 100}%`, background: PHASE_BY_KEY[p.key]?.color ?? '#9ca3af' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12px' }}>
          {scaled.map((p) => (
            <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: PHASE_BY_KEY[p.key]?.color }} />
              {p.title}
            </span>
          ))}
        </div>
        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--muted)' }}>
          {w.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <p style={{ fontSize: '15px', fontWeight: 800, margin: '4px 0 0' }}>Your build, step by step</p>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {w.phases.map((p) => {
          const st = PHASE_BY_KEY[p.key] ?? PHASE_STYLES[0];
          return (
            <li key={p.key} style={{ display: 'flex', gap: '12px', background: st.tint, border: `1px solid ${st.color}33`, borderLeft: `6px solid ${st.color}`, borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <span style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: st.color, color: '#fff', fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.step}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: st.ink }}>{p.title}</span>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: st.ink }}>
                    {p.key === 'CONTINGENCY' ? formatPKR(allowance) : p.amount === null ? (quoteOf(p.key) > 0 ? formatPKR(quoteOf(p.key)) : 'Not estimated') : formatPKR(p.amount)}
                    {p.basis === 'SCALED' && p.amount !== null && (
                      <span style={{ fontWeight: 600, fontSize: '12px', marginLeft: '8px' }}>{pct(p.amount)}% of building cost</span>
                    )}
                    {p.basis === 'REFERENCE' && <span style={{ fontWeight: 600, fontSize: '12px', marginLeft: '8px' }}>reference</span>}
                  </span>
                </div>
                <span style={{ fontSize: '13px', color: '#374151' }}>{p.summary}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {p.includes.map((x) => (
                    <span key={x} style={{ fontSize: '11px', fontWeight: 600, color: st.ink, background: '#fff', border: `1px solid ${st.color}55`, borderRadius: '99px', padding: '2px 8px' }}>
                      {x}
                    </span>
                  ))}
                </div>
                {p.note && <span style={{ fontSize: '12px', color: '#6b7280' }}>{p.note}</span>}
                {p.key === 'CONTINGENCY' ? (
                  <label style={{ fontSize: '12px', fontWeight: 600, color: st.ink, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    Allowance
                    <select value={allowancePct} onChange={(e) => setAllowancePct(Number(e.target.value))} style={{ padding: '4px 8px', border: `1px solid ${st.color}`, borderRadius: '6px', background: '#fff' }}>
                      {ALLOWANCE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{o}%</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  p.basis === 'NOT_ESTIMATED' && (
                    <label style={{ fontSize: '12px', fontWeight: 600, color: st.ink, display: 'flex', gap: '8px', alignItems: 'center' }}>
                      Your quote (PKR)
                      <input
                        inputMode="numeric"
                        value={quotes[p.key] ?? ''}
                        onChange={(e) => setQuotes({ ...quotes, [p.key]: e.target.value })}
                        placeholder="e.g. 150000"
                        style={{ padding: '4px 8px', border: `1px solid ${st.color}`, borderRadius: '6px', width: '140px', background: '#fff' }}
                      />
                    </label>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>
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
        <li>
          Cement, steel, brick, sand, crush, door and window quantities are scaled from a completed 25 x 50 house
          (2,700 sq ft); one house is a single sample.
        </li>
        <li>
          Electrical and plumbing rough-in are priced per sq ft of covered area (conduit, cables, pipes, fittings and
          labour). Fans, lights and sanitary ware are not included, and the count of points will change the real cost.
        </li>
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
        maxWidth: '1240px',
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
          <style>{BOQ_CSS}</style>
          <div className="est-layout">
          {result.whole_house && (
            <div className="est-col">
              <RoadmapCard w={result.whole_house} />
            </div>
          )}
          <div className="est-col" style={result.whole_house ? undefined : { gridColumn: '1 / -1' }}>
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
                {result.state === 'FULL' ? 'Materials & selected works (BOQ) total' : 'Materials & selected works (BOQ), some rates missing'}
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
                      Missing rates for: {result.missing_major_items.join(', ')}. Not included in this materials figure{result.whole_house ? '; the whole-house estimate above already covers them' : ''}.
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

          <p style={{ fontSize: '13px', fontWeight: 700, margin: '4px 0 -8px' }}>
            Materials &amp; selected works (BOQ): cement, steel, bricks, sand, crush, doors, windows, rough-in. Labour,
            tiles, wood, paint, sanitary ware and site work are in the whole-house estimate above.
          </p>
          <BoqList lineItems={result.line_items} basement={result.basement} />

          <AssumptionsBlock result={result} />
          </div>
          </div>

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
