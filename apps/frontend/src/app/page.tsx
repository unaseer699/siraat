'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RecommendationResponse, RecommendationItem } from '@siraat/shared-types';
import { fetchRecommendations } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { ResultsPanel } from '@/components/ResultsPanel';

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Selection for the Comparison feature — lifted here (rather than kept local to
  // ResultsPanel) so a future search can reset it and so other entry points into
  // ResultsPanel could seed/observe it later.
  const [compareSelection, setCompareSelection] = useState<RecommendationItem[]>([]);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setCompareSelection([]);
    try {
      const data = await fetchRecommendations({ query_text: query });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function toggleCompare(item: RecommendationItem) {
    setCompareSelection((prev) => {
      const exists = prev.some((p) => p.society_id === item.society_id);
      if (exists) return prev.filter((p) => p.society_id !== item.society_id);
      if (prev.length >= 3) return prev;
      return [...prev, item];
    });
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

      <Link
        href="/construction-estimate"
        style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)' }}
      >
        🏗 See construction cost estimate for an area →
      </Link>

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

      {result && (
        <ResultsPanel
          result={result}
          compareSelection={compareSelection}
          onToggleCompare={toggleCompare}
        />
      )}

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
