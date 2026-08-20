'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { MaterialRateSourceTier } from '@siraat/shared-types';
import {
  createMaterialRate,
  fetchMaterialRates,
  searchSuppliers,
  type MaterialRateListItem,
  type SupplierSearchResult,
} from '@/lib/api';
import { fieldGroupStyle, inputStyle, labelStyle } from '../constants';
import { AdminNav } from '../AdminNav';
import { TRUST_GREEN, WARNING_AMBER, NEUTRAL_GRAY } from '@/styles/tokens';

const SOURCE_TIER_OPTIONS: { value: MaterialRateSourceTier; label: string }[] = [
  { value: 'MARKET_REFERENCE', label: 'Market Reference' },
  { value: 'SUPPLIER_VERIFIED', label: 'Supplier Verified' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Same visual convention as the public estimate table (EstimateResults.tsx) — a
// filled green pill for supplier-verified rates, a plain outlined gray label for
// market-reference ones, so the tier distinction reads consistently everywhere.
function SourceTierBadge({ tier }: { tier: MaterialRateSourceTier }) {
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

// SUPPLIER DIRECTORY Chunk 2b — search-as-you-type over GET
// /admin/suppliers/search?q=, same shape and debounce as new-society/page.tsx's
// DeveloperSearchField. The operator only ever sees supplier names; the
// selected UUID is tracked internally (supplierId) and never rendered back
// into the input.
function SupplierSearchField({
  query,
  onQueryChange,
  supplierId,
  onSelect,
  onClear,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  supplierId: string | null;
  onSelect: (result: SupplierSearchResult) => void;
  onClear: () => void;
}) {
  const [results, setResults] = useState<SupplierSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || supplierId) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const found = await searchSuppliers(trimmed);
        if (id === requestId.current) setResults(found);
      } catch {
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, supplierId]);

  const showDropdown = !supplierId && query.trim().length > 0 && (searching || results.length > 0);

  return (
    <div style={{ ...fieldGroupStyle, position: 'relative' }}>
      <label style={labelStyle}>Supplier</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Start typing a supplier name…"
          autoComplete="off"
          required
          style={{ ...inputStyle, flex: 1 }}
        />
        {supplierId && (
          <button
            type="button"
            onClick={onClear}
            style={{
              padding: '0 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: '#fff',
              fontSize: '13px',
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {supplierId ? (
        <p style={{ fontSize: '12px', color: '#166534' }}>✓ Linked — this rate will show under this supplier&apos;s profile.</p>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>Select a match to link this rate to a supplier.</p>
      )}

      {showDropdown && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 10,
            margin: 0,
            marginTop: '4px',
            padding: '4px',
            listStyle: 'none',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {searching && (
            <li style={{ padding: '8px 10px', fontSize: '13px', color: 'var(--muted)' }}>Searching…</li>
          )}
          {!searching && results.length === 0 && (
            <li style={{ padding: '8px 10px', fontSize: '13px', color: 'var(--muted)' }}>No matching suppliers</li>
          )}
          {!searching &&
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {r.name}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function MaterialRatesPage() {
  const [materialName, setMaterialName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [city, setCity] = useState('');
  const [sourceTier, setSourceTier] = useState<MaterialRateSourceTier>('MARKET_REFERENCE');
  const [sourceName, setSourceName] = useState('');
  const [sourceContact, setSourceContact] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [recordedDate, setRecordedDate] = useState(todayIso());

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [rates, setRates] = useState<MaterialRateListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const priceNum = Number(price);
  const priceValid = price.trim().length > 0 && Number.isFinite(priceNum) && priceNum > 0;
  // SUPPLIER DIRECTORY Chunk 2c — source_contact is no longer required for
  // SUPPLIER_VERIFIED either: the linked Supplier (via the picker above) now
  // carries the real contact_phone/contact_whatsapp, so retyping it here
  // would just be a redundant, driftable copy. Kept as a free-text optional
  // override field (e.g. a specific salesperson's number for this rate).
  // SUPPLIER DIRECTORY Chunk 2b — source_name is only required for
  // MARKET_REFERENCE now (that tier has no supplier link at all); a
  // SUPPLIER_VERIFIED rate identifies via the supplier picker instead.
  const sourceNameOk = sourceTier !== 'MARKET_REFERENCE' || sourceName.trim().length > 0;
  const supplierOk = sourceTier !== 'SUPPLIER_VERIFIED' || supplierId !== null;
  const canSubmit =
    materialName.trim() &&
    unit.trim() &&
    priceValid &&
    city.trim() &&
    sourceNameOk &&
    supplierOk &&
    recordedDate;

  function handleSupplierSelect(r: SupplierSearchResult) {
    setSupplierId(r.id);
    setSupplierQuery(r.name);
  }

  function handleSupplierQueryChange(v: string) {
    setSupplierQuery(v);
    // Any edit invalidates a prior selection — must re-select to link again.
    setSupplierId(null);
  }

  function handleSupplierClear() {
    setSupplierId(null);
    setSupplierQuery('');
  }

  function loadRates() {
    setListLoading(true);
    setListError(null);
    fetchMaterialRates()
      .then(setRates)
      .catch((err) => setListError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setListLoading(false));
  }

  useEffect(() => {
    loadRates();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createMaterialRate({
        material_name: materialName.trim(),
        unit: unit.trim(),
        price: priceNum,
        city: city.trim(),
        source_tier: sourceTier,
        source_name: sourceName.trim() || null,
        source_contact: sourceTier === 'SUPPLIER_VERIFIED' ? sourceContact.trim() || null : null,
        supplier_id: sourceTier === 'SUPPLIER_VERIFIED' ? supplierId : null,
        recorded_date: recordedDate,
      });
      // Reset the fields an operator is least likely to want repeated between
      // consecutive entries (name/rate/contact); keep city, tier, date, and
      // supplier since a WhatsApp batch or a weekly site check is usually all
      // the same city/tier/day/supplier.
      setMaterialName('');
      setUnit('');
      setPrice('');
      setSourceName('');
      setSourceContact('');
      loadRates();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '32px 24px 48px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <AdminNav active="material-rates" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Material Rates</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Log WhatsApp-relayed supplier rates or the weekly civilconstructionguide.com /
            icons.com.pk check. Each entry is a FACT record.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ ...fieldGroupStyle, flex: 2 }}>
              <label style={labelStyle}>Material name</label>
              <input
                type="text"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder='e.g. "Cement - OPC 50kg bag"'
                required
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={labelStyle}>Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. bag"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={labelStyle}>Price (PKR)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                style={inputStyle}
              />
              {!priceValid && price.trim().length > 0 && (
                <p style={{ fontSize: '12px', color: 'var(--error)' }}>Must be a positive number.</p>
              )}
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={labelStyle}>City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Islamabad"
                required
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={labelStyle}>Recorded date</label>
              <input
                type="date"
                value={recordedDate}
                onChange={(e) => setRecordedDate(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Source tier</label>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {SOURCE_TIER_OPTIONS.map((opt) => (
                <label key={opt.value} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="radio"
                    name="source_tier"
                    checked={sourceTier === opt.value}
                    onChange={() => setSourceTier(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* SUPPLIER DIRECTORY Chunk 2b — the real identity for a
              SUPPLIER_VERIFIED rate now lives here, not in the free-text
              Source name field below (which becomes optional for this tier). */}
          {sourceTier === 'SUPPLIER_VERIFIED' && (
            <SupplierSearchField
              query={supplierQuery}
              onQueryChange={handleSupplierQueryChange}
              supplierId={supplierId}
              onSelect={handleSupplierSelect}
              onClear={handleSupplierClear}
            />
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ ...fieldGroupStyle, flex: 1 }}>
              <label style={labelStyle}>
                Source name{' '}
                {sourceTier === 'SUPPLIER_VERIFIED' ? '(optional override)' : '(site name)'}
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder={
                  sourceTier === 'SUPPLIER_VERIFIED' ? 'e.g. Al-Habib Steel & Cement' : 'e.g. civilconstructionguide.com'
                }
                required={sourceTier === 'MARKET_REFERENCE'}
                style={inputStyle}
              />
              {!sourceNameOk && (
                <p style={{ fontSize: '12px', color: 'var(--error)' }}>
                  Required when source tier is Market Reference.
                </p>
              )}
            </div>

            {/* SUPPLIER DIRECTORY Chunk 2c — optional for SUPPLIER_VERIFIED too now:
                the linked Supplier (picker above) already carries contact_phone/
                contact_whatsapp. Kept as a free-text override, e.g. for a specific
                salesperson's number on this particular rate. MARKET_REFERENCE rates
                are published site figures with no individual to contact at all. */}
            {sourceTier === 'SUPPLIER_VERIFIED' && (
              <div style={{ ...fieldGroupStyle, flex: 1 }}>
                <label style={labelStyle}>Source contact (optional override)</label>
                <input
                  type="text"
                  value={sourceContact}
                  onChange={(e) => setSourceContact(e.target.value)}
                  placeholder="Phone / WhatsApp number"
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {submitError && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius)',
                color: 'var(--error)',
                fontSize: '13px',
              }}
            >
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            style={{
              alignSelf: 'flex-start',
              padding: '12px 20px',
              background: submitting || !canSubmit ? 'var(--muted)' : '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : 'Save rate'}
          </button>
        </form>

        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px' }}>
            Recently entered rates
          </h2>

          {listError && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius)',
                color: 'var(--error)',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {listError}
            </div>
          )}

          {listLoading ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Loading…</p>
          ) : rates.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'var(--muted)' }}>No rates entered yet.</p>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th style={thStyle}>Material</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Price</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Recorded</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        {r.material_name}
                        <span style={{ color: 'var(--muted)', fontSize: '12px' }}> / {r.unit}</span>
                      </td>
                      <td style={tdStyle}>{r.city}</td>
                      <td style={tdStyle}>PKR {r.price.toLocaleString()}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <SourceTierBadge tier={r.source_tier} />
                          {/* FIX: was showing "Supplier #<id fragment>" — the backend now
                              resolves and returns supplier_name (AdminService.listMaterialRates),
                              so prefer that over the raw id. source_name (a manual override,
                              optional since Chunk 2c) still wins when an operator set one;
                              the id fragment is now only a last-resort fallback for a
                              supplier_id whose linked Supplier record can't be resolved
                              (e.g. deleted). */}
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                            {r.source_name ?? r.supplier_name ?? (r.supplier_id ? `Supplier #${r.supplier_id.slice(0, 8)}` : '—')}
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>{r.recorded_date}</td>
                      <td style={tdStyle}>
                        {r.is_stale ? (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: WARNING_AMBER }}>
                            ⚠ Stale (&gt;{r.staleness_threshold_days}d)
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', fontWeight: 700, color: TRUST_GREEN }}>Fresh</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const thStyle: CSSProperties = { padding: '10px 14px', fontWeight: 700, fontSize: '12px' };
const tdStyle: CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' };
