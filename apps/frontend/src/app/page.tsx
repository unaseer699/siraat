'use client';

import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Scale,
  Building2,
  ShieldCheck,
  Wrench,
  Package,
  Home as HomeIcon,
  Check,
  FileCheck,
  MapPin,
  type LucideProps,
} from 'lucide-react';
import type {
  RecommendationResponse,
  RecommendationItem,
  PlatformStatsResponse,
} from '@siraat/shared-types';
import { fetchRecommendations, fetchPlatformStats } from '@/lib/api';
import { SearchBar } from '@/components/SearchBar';
import { ResultsPanel } from '@/components/ResultsPanel';
import {
  TRUST_GREEN,
  WARNING_AMBER,
  ACCENT_BLUE,
  TRUST_GREEN_BG,
  TRUST_GREEN_BORDER,
  TRUST_GREEN_TEXT,
  RADIUS,
} from '@/styles/tokens';

// Static, always-true methodology claims — describe HOW Siraat works, not
// current data volume, so these are never wired to a live count.
const TRUST_STRIP_ITEMS = [
  'Verified against CDA and RDA records',
  'Human-reviewed evidence',
  'No fabricated data',
];

// A count of 0 (fresh install / no data yet) is shown as an honest "Just
// getting started" rather than a bare "0" that could read as a broken/errored
// metric — same honesty principle the platform applies to its own coverage
// data (see NOT_COVERED state elsewhere). Carried over unchanged from the
// prior pass; only the card presentation below has changed.
function statValue(count: number): string {
  return count === 0 ? 'Just getting started' : count.toLocaleString();
}

// Trust-style hero band: flat tinted container (TRUST_GREEN_BG/BORDER/TEXT,
// imported from tokens.ts) with a
// small evidence-badge pill, title, tagline, a distinct white bordered search
// card, and the trust strip attached directly beneath. Single rounded shell
// (border-radius + overflow:hidden on the outer wrapper) rather than juggling
// single-sided border-radius on two separate stacked elements — the hero
// zone and trust-strip zone inside it have no radius of their own at all.
function HeroBand({
  onSearch,
  loading,
  initialValue,
  showHint,
}: {
  onSearch: (query: string, opts?: { skipUrlUpdate?: boolean }) => void;
  loading: boolean;
  initialValue: string;
  showHint: boolean;
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '720px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${TRUST_GREEN_BORDER}`,
      }}
    >
      <div
        style={{
          background: TRUST_GREEN_BG,
          padding: '40px 24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#fff',
            border: `1px solid ${TRUST_GREEN_BORDER}`,
            borderRadius: '99px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: TRUST_GREEN_TEXT,
          }}
        >
          <ShieldCheck size={14} color={TRUST_GREEN} aria-hidden="true" />
          Evidence-backed real estate intelligence
        </span>

        <header style={{ textAlign: 'center', maxWidth: '640px' }}>
          <h1 style={{ fontSize: '52px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
            Siraat
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--muted)', marginTop: '14px' }}>
            Buy with proof, not promises.
          </p>
        </header>

        <div
          style={{
            width: '100%',
            maxWidth: '640px',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: RADIUS.lg,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <SearchBar onSearch={onSearch} loading={loading} initialValue={initialValue} />

          {showHint && (
            <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center' }}>
              Search in: Islamabad, Rawalpindi
              <br />
              e.g. &ldquo;10 Marla plot in Islamabad under 2.5 Crore&rdquo;
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          borderTop: `1px solid ${TRUST_GREEN_BORDER}`,
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        {TRUST_STRIP_ITEMS.map((label) => (
          <span
            key={label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)' }}
          >
            <Check size={14} color={TRUST_GREEN} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Icon-square + number + label, side by side (not stacked) — replaces the
// prior plain-inline-row stat presentation. Numbers are unchanged: still
// straight off the live fetchPlatformStats() call passed in from HomeView,
// with the same statValue() zero-state fallback, just presented as cards.
function StatCardsRow({ stats }: { stats: PlatformStatsResponse | null }) {
  if (!stats) return null;

  const items: {
    icon: ComponentType<LucideProps>;
    color: string;
    value: string;
    label: string;
    href?: string;
    aria: string;
  }[] = [
    {
      icon: Building2,
      color: ACCENT_BLUE,
      value: statValue(stats.verified_societies_count),
      label: 'Societies',
      href: '/browse',
      aria: 'Browse verified societies',
    },
    {
      icon: FileCheck,
      color: TRUST_GREEN,
      value: statValue(stats.total_evidence_count),
      label: 'Evidence',
      aria: 'Evidence items on record',
    },
    {
      icon: MapPin,
      color: WARNING_AMBER,
      value: statValue(stats.cities_covered.length),
      label: 'Cities',
      aria: 'Cities covered',
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '720px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const card = (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: RADIUS.md,
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                flexShrink: 0,
                borderRadius: RADIUS.sm,
                background: `${item.color}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={20} color={item.color} aria-hidden="true" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{item.value}</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>{item.label}</span>
            </div>
          </div>
        );
        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            aria-label={item.aria}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {card}
          </Link>
        ) : (
          <div key={item.label}>{card}</div>
        );
      })}
    </div>
  );
}

// Icon-first: icon + 1-2 word title, plus a short (4-6 word) muted subtitle —
// same heading + supporting-line pattern used elsewhere (e.g. society/[id]
// and contractor/[id] profile headers: bold heading, then a smaller
// var(--muted) line directly below), not a return to full paragraph copy.
// `qa-card` is the hover convention defined once in globals.css (border-color
// shift, no transform — nothing else in the app uses a hover transform to reuse).
function QuickAccessCard({
  href,
  icon: Icon,
  title,
  subtitle,
  ariaLabel,
}: {
  href?: string;
  icon: ComponentType<LucideProps>;
  title: string;
  subtitle: string;
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{subtitle}</p>
      </div>
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

      <HeroBand
        onSearch={handleSearch}
        loading={loading}
        initialValue={searchParams.get('q') ?? ''}
        showHint={!result && !loading && !error}
      />

      <StatCardsRow stats={stats} />

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
          subtitle="See societies side by side"
          ariaLabel="Compare societies"
        />
        <QuickAccessCard
          href="/construction-estimate"
          icon={Building2}
          title="Cost Estimate"
          subtitle="Real material cost breakdown"
          ariaLabel="Construction cost estimate"
        />
        <QuickAccessCard
          icon={ShieldCheck}
          title="How We Verify"
          subtitle="Evidence behind every score"
          ariaLabel="How Siraat verifies societies"
        />
        <QuickAccessCard
          href="/contractors"
          icon={Wrench}
          title="Contractors"
          subtitle="Find verified trades near you"
          ariaLabel="Find contractors"
        />
        {/* SUPPLIER DIRECTORY Chunk 3 — 5th quick-access spot, same pattern as Contractors above. */}
        <QuickAccessCard
          href="/suppliers"
          icon={Package}
          title="Suppliers"
          subtitle="Find verified material suppliers"
          ariaLabel="Find suppliers"
        />
        {/* HOUSE PLANS DIRECTORY Chunk 2 — 6th quick-access spot, same pattern as Suppliers above. */}
        <QuickAccessCard
          href="/house-plans"
          icon={HomeIcon}
          title="House Plans"
          subtitle="Browse ready-made floor plans"
          ariaLabel="Browse house plans"
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
