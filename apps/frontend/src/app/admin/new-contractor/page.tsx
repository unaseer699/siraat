'use client';

import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import type { TradeCategory } from '@siraat/shared-types';
import {
  createContractor,
  setContractorVerified,
  fetchPlatformStats,
} from '@/lib/api';
import { AdminNav } from '../AdminNav';
import { VerifiedField } from '@/components/VerifiedField';
import {
  CANONICAL_CITY_OPTIONS,
  TRADE_CATEGORY_OPTIONS,
  fieldGroupStyle,
  inputStyle,
  labelStyle,
} from '../constants';

// CONTRACTOR DIRECTORY Chunk 2b — same select + "type manually" convention as
// EstimateForm's city field (apps/frontend/src/components/EstimateForm.tsx),
// extended to a multi-select since a contractor can serve more than one city.
function ServiceCitiesField({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (cities: string[]) => void;
}) {
  // PRE-DATA-POPULATION REVIEW finding #10 — seed with the canonical list so
  // the checkbox set isn't empty before any Society has been onboarded;
  // fetchPlatformStats() below adds in any real city not already covered.
  const [cities, setCities] = useState<string[]>(CANONICAL_CITY_OPTIONS);
  const [manualCity, setManualCity] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStats()
      .then((stats) => {
        if (!cancelled) {
          setCities((prev) => Array.from(new Set([...prev, ...stats.cities_covered])).sort());
        }
      })
      .catch(() => {
        // City list is a nice-to-have — manual entry below still covers it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleCity(city: string) {
    onChange(selected.includes(city) ? selected.filter((c) => c !== city) : [...selected, city]);
  }

  function addManualCity() {
    const trimmed = manualCity.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed]);
    setManualCity('');
  }

  // A manually-added city not in the fetched list still needs its own
  // checkbox so it stays visible and removable.
  const extraCities = selected.filter((c) => !cities.includes(c));
  const allCities = [...cities, ...extraCities];

  return (
    <div style={fieldGroupStyle}>
      <label style={labelStyle}>Service cities</label>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {allCities.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No cities yet — add one below.</p>
        )}
        {allCities.map((c) => (
          <label key={c} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={selected.includes(c)} onChange={() => toggleCity(c)} />
            {c}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={manualCity}
          onChange={(e) => setManualCity(e.target.value)}
          placeholder="Add another city…"
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addManualCity();
            }
          }}
        />
        <button
          type="button"
          onClick={addManualCity}
          style={{
            padding: '0 14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function NewContractorForm() {
  const params = useSearchParams();

  const [name, setName] = useState(params.get('name') ?? '');
  const [tradeCategories, setTradeCategories] = useState<TradeCategory[]>([]);
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [contactPhone, setContactPhone] = useState('');
  const [contactWhatsapp, setContactWhatsapp] = useState('');
  const [isAffiliated, setIsAffiliated] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedNote, setVerifiedNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ contractor_id: string } | null>(null);

  function toggleTrade(t: TradeCategory) {
    setTradeCategories((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const canSubmit =
    name.trim().length > 0 &&
    tradeCategories.length > 0 &&
    serviceCities.length > 0 &&
    contactPhone.trim().length > 0 &&
    (!verified || verifiedNote.trim().length > 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const contractor = await createContractor({
        name: name.trim(),
        trade_categories: tradeCategories,
        service_cities: serviceCities,
        contact_phone: contactPhone.trim(),
        contact_whatsapp: contactWhatsapp.trim() || null,
        is_siraat_affiliated: isAffiliated,
      });
      if (verified) await setContractorVerified(contractor.id, true, verifiedNote.trim());
      setResult({ contractor_id: contractor.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px 32px', gap: '28px' }}>
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <AdminNav active="contractors" />
      </div>

      <article style={{ maxWidth: '640px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            ADMIN — INTERNAL ONLY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Onboard Contractor</h1>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '6px' }}>
            Adds a contractor to the directory. Verification can be added later, once there is proof.
          </p>
        </div>

        {result ? (
          <div
            style={{
              padding: '20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 'var(--radius)',
              color: '#166534',
              fontSize: '15px',
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            Contractor onboarded
            <p style={{ fontSize: '13px', fontWeight: 400, color: '#166534' }}>
              Contractor ID: {result.contractor_id}
            </p>
            <div style={{ display: 'flex', gap: '12px', fontWeight: 600 }}>
              <Link href={`/admin/contractor/${result.contractor_id}/portfolio`} style={{ fontSize: '13px' }}>
                Add portfolio projects →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>Contractor</legend>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
              </div>

              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Trade categories</label>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                  {TRADE_CATEGORY_OPTIONS.map((t) => (
                    <label key={t.value} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={tradeCategories.includes(t.value)}
                        onChange={() => toggleTrade(t.value)}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              <ServiceCitiesField selected={serviceCities} onChange={setServiceCities} />

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Contact phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. 0300-1234567"
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ ...fieldGroupStyle, flex: 1 }}>
                  <label style={labelStyle}>Contact WhatsApp (optional)</label>
                  <input
                    type="text"
                    value={contactWhatsapp}
                    onChange={(e) => setContactWhatsapp(e.target.value)}
                    placeholder="e.g. 0300-1234567"
                    style={inputStyle}
                  />
                </div>
              </div>

              <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={isAffiliated} onChange={(e) => setIsAffiliated(e.target.checked)} />
                Siraat-affiliated
              </label>
            </fieldset>

            <VerifiedField verified={verified} note={verifiedNote} onChange={(v) => { setVerified(v.verified); setVerifiedNote(v.note); }} />

            {error && (
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
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !canSubmit}
              style={{
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
              {submitting ? 'Creating…' : 'Create contractor'}
            </button>
          </form>
        )}
      </article>
    </main>
  );
}

export default function NewContractorPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewContractorForm />
    </Suspense>
  );
}

const fieldsetStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const legendStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--muted)',
  padding: '0 6px',
};
