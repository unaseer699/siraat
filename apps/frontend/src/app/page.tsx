'use client';

import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Scale, Building2, ShieldCheck, Wrench, type LucideProps } from 'lucide-react';
import type {
  RecommendationResponse,
  RecommendationItem,
  PlatformStatsResponse,
} from '@siraat/shared-types';
import { fetchRecommendations, fetchPlatformStats } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { ResultsPanel } from '@/components/ResultsPanel';
import { NEUTRAL_GRAY, RADIUS } from '@/styles/tokens';

// A count of 0 (fresh install / no data yet) is shown as an honest "Just
// getting started" rather than a bare "0" that could read as a broken/errored
// metric — same honesty principle the platform applies to its own coverage
// data (see NOT_COVERED state elsewhere). Unchanged from the previous
// StatCard-based layout, just no longer paired with a success/neutral tone
// since the plain inline row below doesn't color-code numbers.
function statValue(count: number): string {
  return count === 0 ? 'Just getting started' : count.toLocaleString();
}

// Plain inline row with thin dividers, replacing the bordered StatCard grid —
// numbers still come straight from the live fetchPlatformStats() call, only
// the container is restyled.
function StatsRow({ stats }: { stats: PlatformStatsResponse | null }) {
  if (!stats) return null;

  const items: { value: string; label: string; href?: string; aria: string }[] = [
    {
      value: statValue(stats.verified_societies_count),
      label: 'Societies',
      href: '/browse',
      aria: 'Browse verified societies',
    },
    { value: statValue(stats.total_evidence_count), label: 'Evidence', aria: 'Evidence items on record' },
    { value: statValue(stats.cities_covered.length), label: 'Cities', aria: 'Cities covered' },
  ];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
      {items.map((item, i) => {
        const inner = (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '0 28px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{item.value}</span>
            <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>{item.label}</span>
          </div>
        );
        return (
          <div
            key={item.label}
            style={{ borderRight: i < items.length - 1 ? `0.5px solid ${NEUTRAL_GRAY}40` : 'none' }}
          >
            {item.href ? (
              <Link href={item.href} aria-label={item.aria} style={{ color: 'inherit', textDecoration: 'none' }}>
                {inner}
              </Link>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </div>
  );
}

// Icon-first: icon + 1-2 word title only, no body copy. `qa-card` is the
// hover convention defined once in globals.css (border-color shift, no
// transform — nothing else in the app uses a hover transform to reuse).
function QuickAccessCard({
  href,
  icon: Icon,
  title,
  ariaLabel,
}: {
  href?: string;
  icon: ComponentType<LucideProps>;
  title: string;
  ariaLabel: string;
}) {
  const content = (
    <div
      className={href ? 'qa-card' : undefined}
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        padding: '24px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <Icon size={26} color="var(--brand)" aria-hidden="true" />
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
    </div>
  );

  if (!href) {
    return (
      <div style={{ flex: '1 1 220px', minWidth: '220px' }} aria-label={ariaLabel}>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} aria-label={ariaLabel} style={{ flex: '1 1 220px', minWidth: '220px', display: 'block' }}>
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
        <p style={{ fontSize: '18px', color: 'var(--muted)', marginTop: '14px' }}>
          Real estate you can verify.
        </p>
      </header>

      <StatsRow stats={stats} />

      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
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
      </div>

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
          icon={Scale}
          title="Compare"
          ariaLabel="Compare societies"
        />
        <QuickAccessCard
          href="/construction-estimate"
          icon={Building2}
          title="Cost Estimate"
          ariaLabel="Construction cost estimate"
        />
        <QuickAccessCard
          icon={ShieldCheck}
          title="How We Verify"
          ariaLabel="How Siraat verifies societies"
        />
        <QuickAccessCard
          href="/contractors"
          icon={Wrench}
          title="Contractors"
          ariaLabel="Find contractors"
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
