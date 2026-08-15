'use client';

import { useEffect, useState } from 'react';
import type { EstimateRequest, QualityTier } from '@siraat/shared-types';
import { fetchPlatformStats } from '@/lib/api';

interface EstimateFormProps {
  onSubmit: (req: EstimateRequest) => void;
  loading: boolean;
}

const QUALITY_TIERS: { value: QualityTier; label: string }[] = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'PREMIUM', label: 'Premium' },
];

const AREA_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: '3 Marla' },
  { value: 5, label: '5 Marla' },
  { value: 7, label: '7 Marla' },
  { value: 10, label: '10 Marla' },
  { value: 20, label: '1 Kanal (20 Marla)' },
  { value: 40, label: '2 Kanal (40 Marla)' },
];

// Sentinel select value for "enter it manually" — distinct from any real city
// name or area size, so it can't collide with a fetched/listed option.
const OTHER = 'OTHER';

const fieldStyle = {
  padding: '12px 16px',
  border: '2px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '16px',
  outline: 'none',
  width: '100%',
};

const selectStyle = { ...fieldStyle, background: '#fff', cursor: 'pointer' };

export function EstimateForm({ onSubmit, loading }: EstimateFormProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [citySelect, setCitySelect] = useState('');
  const [cityManual, setCityManual] = useState('');

  const [areaSelect, setAreaSelect] = useState('');
  const [areaManual, setAreaManual] = useState('');

  const [qualityTier, setQualityTier] = useState<QualityTier>('STANDARD');

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStats()
      .then((stats) => {
        if (!cancelled) setCities(stats.cities_covered);
      })
      .catch(() => {
        // City list is a nice-to-have — the "Other (type manually)" option
        // still covers city entry if this fails or returns nothing.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const city = citySelect === OTHER ? cityManual.trim() : citySelect;
  const areaMarla = areaSelect === OTHER ? Number(areaManual) : Number(areaSelect);

  const canSubmit = city.length > 0 && areaSelect.length > 0 && areaMarla > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ city, area_marla: areaMarla, quality_tier: qualityTier });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '480px',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>City</span>
        <select
          value={citySelect}
          onChange={(e) => setCitySelect(e.target.value)}
          aria-label="City"
          style={selectStyle}
        >
          <option value="" disabled>
            Select a city…
          </option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={OTHER}>Other (type manually)</option>
        </select>
        {citySelect === OTHER && (
          <input
            type="text"
            value={cityManual}
            onChange={(e) => setCityManual(e.target.value)}
            placeholder="Enter city name"
            aria-label="City (manual entry)"
            style={{ ...fieldStyle, marginTop: '4px' }}
          />
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
          Area (Marla)
        </span>
        <select
          value={areaSelect}
          onChange={(e) => setAreaSelect(e.target.value)}
          aria-label="Area in Marla"
          style={selectStyle}
        >
          <option value="" disabled>
            Select a size…
          </option>
          {AREA_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
          <option value={OTHER}>Other (enter custom size)</option>
        </select>
        {areaSelect === OTHER && (
          <input
            type="number"
            min={0}
            step="any"
            value={areaManual}
            onChange={(e) => setAreaManual(e.target.value)}
            placeholder="e.g. 12.5"
            aria-label="Area in Marla (custom)"
            style={{ ...fieldStyle, marginTop: '4px' }}
          />
        )}
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
          Quality tier
        </span>
        <select
          value={qualityTier}
          onChange={(e) => setQualityTier(e.target.value as QualityTier)}
          aria-label="Quality tier"
          style={selectStyle}
        >
          {QUALITY_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={loading || !canSubmit}
        style={{
          marginTop: '4px',
          padding: '12px 24px',
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontSize: '16px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading || !canSubmit ? 0.7 : 1,
        }}
      >
        {loading ? 'Estimating…' : 'Estimate cost'}
      </button>
    </form>
  );
}
