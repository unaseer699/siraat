'use client';

import { useState } from 'react';
import type { RecommendationResponse } from '@siraat/shared-types';
import { fetchRecommendations } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { ResultsPanel } from '@/components/ResultsPanel';

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchRecommendations({ query_text: query });
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
        padding: '64px 16px 32px',
        gap: '32px',
      }}
    >
      <header style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.5px' }}>Siraat</h1>
        <p style={{ color: 'var(--muted)', marginTop: '4px' }}>
          The Trust Operating System for Real Estate
        </p>
      </header>

      <SearchBar onSearch={handleSearch} loading={loading} />

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

      {result && <ResultsPanel result={result} />}

      {!result && !loading && !error && (
        <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
          Search in: Islamabad, Rawalpindi
          <br />
          e.g. &ldquo;10 Marla plot in Islamabad under 2.5 Crore&rdquo;
        </p>
      )}
    </main>
  );
}
