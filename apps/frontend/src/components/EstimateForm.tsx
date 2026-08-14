'use client';

import { useState } from 'react';
import type { EstimateRequest, QualityTier } from '@siraat/shared-types';

interface EstimateFormProps {
  onSubmit: (req: EstimateRequest) => void;
  loading: boolean;
}

const QUALITY_TIERS: { value: QualityTier; label: string }[] = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'PREMIUM', label: 'Premium' },
];

const fieldStyle = {
  padding: '12px 16px',
  border: '2px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '16px',
  outline: 'none',
  width: '100%',
};

export function EstimateForm({ onSubmit, loading }: EstimateFormProps) {
  const [city, setCity] = useState('');
  const [areaMarla, setAreaMarla] = useState('');
  const [qualityTier, setQualityTier] = useState<QualityTier>('STANDARD');

  const area = Number(areaMarla);
  const canSubmit = city.trim().length > 0 && areaMarla.trim().length > 0 && area > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ city: city.trim(), area_marla: area, quality_tier: qualityTier });
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
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Islamabad"
          aria-label="City"
          style={fieldStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
          Area (Marla)
        </span>
        <input
          type="number"
          min={0}
          step="any"
          value={areaMarla}
          onChange={(e) => setAreaMarla(e.target.value)}
          placeholder="e.g. 10"
          aria-label="Area in Marla"
          style={fieldStyle}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
          Quality tier
        </span>
        <select
          value={qualityTier}
          onChange={(e) => setQualityTier(e.target.value as QualityTier)}
          aria-label="Quality tier"
          style={{ ...fieldStyle, background: '#fff', cursor: 'pointer' }}
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
