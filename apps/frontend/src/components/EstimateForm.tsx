'use client';

import { useState } from 'react';
import type { BoqRequest, BoqAreaUnit, BoqFloors, FinishLevel } from '@siraat/shared-types';

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

// Siraat prices Islamabad and Rawalpindi only, as one market. More cities will
// be added as their data comes in.
const SUPPORTED_CITIES = ['Islamabad', 'Rawalpindi'] as const;

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
  const [citySelect, setCitySelect] = useState<string>(SUPPORTED_CITIES[0]);

  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<BoqAreaUnit>('MARLA');
  // PLOT: the plot size, with every floor assumed to cover about the whole plot.
  // COVERED: the total built area across all floors, entered directly.
  const [areaMode, setAreaMode] = useState<'PLOT' | 'COVERED'>('PLOT');
  const [floors, setFloors] = useState<BoqFloors>(1);
  const [basement, setBasement] = useState(false);
  const [finishLevel, setFinishLevel] = useState<FinishLevel>('STANDARD');

  const city = citySelect;
  const areaNumber = Number(area);

  const enteredSqft = areaNumber * (areaUnit === 'MARLA' ? 225 : 1);
  // Plot size x floors misses the stair head (mumty), porch and balconies. On the
  // completed 25 x 50 house, 2,700 sq ft covered vs 2 x 1,250 plot = +8%, so a
  // multi-floor plot is uplifted by 8%. One house is one sample.
  const PLOT_UPLIFT = floors > 1 ? 1.08 : 1;
  const coveredSqft = areaMode === 'PLOT' ? enteredSqft * floors * PLOT_UPLIFT : enteredSqft;
  const canSubmit = city.length > 0 && area.length > 0 && areaNumber > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      city,
      area: areaMode === 'PLOT' ? Math.round(coveredSqft * 100) / 100 : areaNumber,
      area_unit: areaMode === 'PLOT' ? 'SQFT' : areaUnit,
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
          {SUPPORTED_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Islamabad and Rawalpindi share one market, so prices are the same for both.</span>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={labelTextStyle}>{areaMode === 'PLOT' ? 'Plot size' : 'Total covered area (sum of all floors)'}</span>
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="radio" name="areaMode" checked={areaMode === 'PLOT'} onChange={() => setAreaMode('PLOT')} />
            Plot size
          </label>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="radio" name="areaMode" checked={areaMode === 'COVERED'} onChange={() => setAreaMode('COVERED')} />
            Total covered area
          </label>
        </div>
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
        {coveredSqft > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {areaMode === 'PLOT'
              ? `Covered area used: ${Math.round(coveredSqft).toLocaleString()} sq ft (plot × ${floors} floor${floors > 1 ? 's' : ''}${floors > 1 ? ' + 8% for stair head, porch and balconies' : ''}). Switch to "Total covered area" to enter the exact built area.`
              : `Covered area used: ${Math.round(coveredSqft).toLocaleString()} sq ft across all floors.`}
          </span>
        )}
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
        <span style={labelTextStyle}>Basement (extra level below ground, same size as one floor)</span>
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
