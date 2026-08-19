'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  RecommendationResponse,
  RecommendationItem,
  PlatformStatsResponse,
} from '@siraat/shared-types';
import { fetchRecommendations, fetchPlatformStats } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { ResultsPanel } from '@/components/ResultsPanel';
import StatCard from '@/components/StatCard';
import { RADIUS } from '@/styles/tokens';

// Renders a single headline stat. A count of 0 (fresh install / no data yet)
// is shown as an honest "Just getting started" rather than a bare "0" that
// could read as a broken/errored metric — same honesty principle the platform
// applies to its own coverage data (see NOT_COVERED state elsewhere).
function statValue(count: number): { value: string; tone: 'success' | 'neutral' } {
  return count === 0
    ? { value: 'Just getting started', tone: 'neutral' }
    : { value: count.toLocaleString(), tone: 'success' };
}

function StatsRow({ stats }: { stats: PlatformStatsResponse | null }) {
  if (!stats) return null;

  const societies = statValue(stats.verified_societies_count);
  const evidence = statValue(stats.total_evidence_count);
  const cities = statValue(stats.cities_covered.length);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '720px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      }}
    >
      <Link href="/browse" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        <StatCard icon="🏘️" value={societies.value} label="Verified Societies" tone={societies.tone} />
      </Link>
      <StatCard icon="📄" value={evidence.value} label="Evidence Items on Record" tone={evidence.tone} />
      <StatCard icon="🏙️" value={cities.value} label="Cities Covered" tone={cities.tone} />
    </div>
  );
}

function QuickAccessCard({
  href,
  icon,
  title,
  description,
}: {
  href?: string;
  icon: string;
  title: string;
  description: string;
}) {
  const content = (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{icon}</span>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, flex: 1 }}>
        {description}
      </p>
      {href && (
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand)' }}>Open →</span>
      )}
    </div>
  );

  if (!href) {
    return <div style={{ flex: '1 1 220px', minWidth: '220px' }}>{content}</div>;
  }

  return (
    <Link href={href} style={{ flex: '1 1 220px', minWidth: '220px', display: 'block' }}>
      {content}
    </Link>
  );
}

function HomeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Selection for the Comparison feature — lifted here (rather than kept local to
  // ResultsPanel) so a future search can reset it and so other entry points into
  // ResultsPanel could seed/observe it later.
  const [compareSelection, setCompareSelection] = useState<RecommendationItem[]>([]);
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null);
  // Tracks the query we last searched (whether triggered by the user or by
  // restoring the `?q=` param) so the URL-sync effect below doesn't re-fire a
  // fetch for a query it already knows about — including the push it just made.
  const lastSyncedQuery = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStats()
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // Headline stats are a nice-to-have on the hero — fail silently rather
        // than blocking or cluttering the page with an error banner.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSearch(query: string, opts?: { skipUrlUpdate?: boolean }) {
    lastSyncedQuery.current = query;
    if (!opts?.skipUrlUpdate) {
      router.push(`/?q=${encodeURIComponent(query)}`, { scroll: false });
    }
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

  // Restores prior search state on mount and on back/forward navigation — e.g.
  // after visiting a result's detail page and hitting the browser back button.
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && q !== lastSyncedQuery.current) {
      handleSearch(q, { skipUrlUpdate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function toggleCompare(item: RecommendationItem) {
    setCompareSelection((prev) => {
      const exists = prev.some((p) => p.society_id === item.society_id);
      if (exists) return prev.filter((p) => p.society_id !== item.society_id);
      if (prev.length >= 3) return prev;
      return [...prev, item];
    });
  }

  const canCompare = compareSelection.length >= 2;
  const compareHref = canCompare
    ? `/compare?ids=${encodeURIComponent(compareSelection.map((c) => c.society_id).join(','))}`
    : undefined;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 16px 48px',
        gap: '40px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '720px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/watchlist" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
          ☆ Watchlist
        </Link>
      </div>

      <header style={{ textAlign: 'center', maxWidth: '640px' }}>
        <h1 style={{ fontSize: '52px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
          Siraat
        </h1>
        <p style={{ fontSize: '20px', color: 'var(--muted)', marginTop: '12px' }}>
          The Trust Operating System for Real Estate
        </p>
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginTop: '20px' }}>
          Every recommendation is backed by verified evidence, not opinions.
        </p>
      </header>

      <StatsRow stats={stats} />

      <section
        style={{
          width: '100%',
          maxWidth: '720px',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: RADIUS.lg,
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <SearchBar onSearch={handleSearch} loading={loading} initialValue={searchParams.get('q') ?? ''} />

        {!result && !loading && !error && (
          <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center' }}>
            Search in: Islamabad, Rawalpindi
            <br />
            e.g. &ldquo;10 Marla plot in Islamabad under 2.5 Crore&rdquo;
          </p>
        )}
      </section>

      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <QuickAccessCard
          href={compareHref}
          icon="⚖️"
          title="Compare Societies"
          description={
            canCompare
              ? `Compare your ${compareSelection.length} selected societies side by side.`
              : 'Search first, then add 2–3 societies from your results to compare confidence scores side by side.'
          }
        />
        <QuickAccessCard
          href="/construction-estimate"
          icon="🏗"
          title="Construction Cost Estimate"
          description="Grey-structure material cost, broken down by source and freshness — not a guess."
        />
        <QuickAccessCard
          icon="🛡️"
          title="How Siraat Verifies Societies"
          description="Every score combines documented Evidence, Regulatory Records (NOC, approvals), and Independent Verification — affiliation never influences the score."
        />
        <QuickAccessCard
          href="/contractors"
          icon="🔧"
          title="Find Contractors"
          description="Browse verified electricians, plumbers, masons and other trades by city — same claim-and-evidence trust model as societies."
        />
      </div>

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
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeView />
    </Suspense>
  );
}
