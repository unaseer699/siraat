'use client';

import { useEffect, useState } from 'react';
import type { BoqRequest, BoqAreaUnit, BoqFloors, FinishLevel } from '@siraat/shared-types';
import { fetchPlatformStats } from '@/lib/api';

interface EstimateFormProps {
  onSubmit: (req: BoqRequest) => void;
  loading: boolean;
}

const FINISH_LEVELS: { value: FinishLevel; label: string }[] = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'PREMIUM', label: 'Premium' },
];

const FLOOR_OPTIONS: BoqFloors[] = [1, 2, 3];

// Sentinel select value for "enter it manually" — distinct from any real city
// name, so it can't collide with a fetched/listed option.
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

const labelTextStyle = { fontSize: '13px', fontWeight: 600, color: 'var(--muted)' };

export function EstimateForm({ onSubmit, loading }: EstimateFormProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [citySelect, setCitySelect] = useState('');
  const [cityManual, setCityManual] = useState('');

  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<BoqAreaUnit>('MARLA');
  const [floors, setFloors] = useState<BoqFloors>(1);
  const [basement, setBasement] = useState(false);
  const [finishLevel, setFinishLevel] = useState<FinishLevel>('STANDARD');

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
  const areaNumber = Number(area);

  const canSubmit = city.length > 0 && area.length > 0 && areaNumber > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      city,
      area: areaNumber,
      area_unit: areaUnit,
      floors,
      basement,
      finish_level: finishLevel,
    });
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
        <span style={labelTextStyle}>City</span>
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
        <span style={labelTextStyle}>Total covered area (sum of all floors)</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            min={0}
            step="any"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. 2250"
            aria-label="Total covered area"
            style={{ ...fieldStyle, flex: 1 }}
          />
          <select
            value={areaUnit}
            onChange={(e) => setAreaUnit(e.target.value as BoqAreaUnit)}
            aria-label="Area unit"
            style={{ ...selectStyle, width: '110px', flexShrink: 0 }}
          >
            <option value="SQFT">sq ft</option>
            <option value="MARLA">Marla</option>
          </select>
        </div>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={labelTextStyle}>Number of floors</span>
        <select
          value={floors}
          onChange={(e) => setFloors(Number(e.target.value) as BoqFloors)}
          aria-label="Number of floors"
          style={selectStyle}
        >
          {FLOOR_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={basement}
          onChange={(e) => setBasement(e.target.checked)}
          aria-label="Basement"
          style={{ width: '18px', height: '18px' }}
        />
        <span style={labelTextStyle}>Basement</span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={labelTextStyle}>Finish level</span>
        <select
          value={finishLevel}
          onChange={(e) => setFinishLevel(e.target.value as FinishLevel)}
          aria-label="Finish level"
          style={selectStyle}
        >
          {FINISH_LEVELS.map((t) => (
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
        {loading ? 'Estimating…' : 'Generate BOQ'}
      </button>
    </form>
  );
}
