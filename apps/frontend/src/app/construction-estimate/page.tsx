'use client';

import { useState } from 'react';
import type { EstimateRequest, EstimateResponse } from '@siraat/shared-types';
import { fetchConstructionEstimate } from '@/lib/api';
import { EstimateForm } from '@/components/EstimateForm';
import { EstimateResults } from '@/components/EstimateResults';
import { BackLink } from '@/components/BackLink';

export default function ConstructionEstimatePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(req: EstimateRequest) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchConstructionEstimate(req);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 16px 32px',
        gap: '32px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <BackLink />
      </div>

      <header style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Construction Cost Estimate
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: '4px' }}>
          Grey-structure material cost, broken down by source and freshness
        </p>
      </header>

      <EstimateForm onSubmit={handleSubmit} loading={loading} />

      {error && (
        <div
          style={{
            maxWidth: '680px',
            width: '100%',
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius)',
            color: 'var(--error)',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {result && <EstimateResults result={result} />}

      {!result && !loading && !error && (
        <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
          Covers: Islamabad, Rawalpindi
        </p>
      )}
    </main>
  );
}
