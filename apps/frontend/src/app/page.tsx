'use client';

import { Suspense, useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Scale,
  Building2,
  ShieldCheck,
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
import { QuickAccessCard } from '@/components/QuickAccessCard';
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
  'Verified against CDA & RDA records',
  'Human-reviewed evidence',
  'No fabricated data',
];

// HOMEPAGE REDESIGN (P0, 29 Sep) — nearest existing routes for the two hero
// CTAs, chosen per the brief's own rule ("nearest existing ... route"). Both
// are exact matches, not fallbacks: /browse is the existing society browse/
// list page, /construction-estimate is the existing cost-estimate flow.
const CHECK_SOCIETY_HREF = '/browse';
const ESTIMATE_BUILD_COST_HREF = '/construction-estimate';

// Equal visual weight per the brief — both hero CTAs share this style, only
// the label differs.
const heroCtaStyle: CSSProperties = {
  flex: '1 1 220px',
  textAlign: 'center',
  padding: '14px 20px',
  background: 'var(--brand)',
  color: '#fff',
  borderRadius: RADIUS.md,
  fontSize: '15px',
  fontWeight: 700,
  textDecoration: 'none',
};

// Trust-style hero band: flat tinted container (TRUST_GREEN_BG/BORDER/TEXT,
// imported from tokens.ts) with a
// small evidence-badge pill, title, tagline, two equal-weight CTA buttons
// (HOMEPAGE REDESIGN — replaces the old free-text search as the primary hero
// action; search still exists further down the page as a secondary
// capability, see SecondarySearch below), and the trust strip attached
// directly beneath. Single rounded shell (border-radius + overflow:hidden on
// the outer wrapper) rather than juggling single-sided border-radius on two
// separate stacked elements — the hero zone and trust-strip zone inside it
// have no radius of their own at all.
function HeroBand() {
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
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              width: '100%',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Link href={CHECK_SOCIETY_HREF} style={heroCtaStyle}>
              Check a Society
            </Link>
            <Link href={ESTIMATE_BUILD_COST_HREF} style={heroCtaStyle}>
              Estimate Build Cost
            </Link>
          </div>

          <a href="#how-we-verify" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
            See how we verify every claim →
          </a>
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

// HOMEPAGE REDESIGN — free-text search demoted from the primary hero action
// to this small, visually quiet section further down the page. Left fully
// functional (same handleSearch/ResultsPanel/compare-selection wiring as
// before this change) rather than removed: /compare's empty-state copy
// ("select 2 or 3 societies... using the checkbox on each result") still
// refers to this exact flow, so removing it would strand that page.
function SecondarySearch({
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
        maxWidth: '640px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>Or search a specific property</p>
      <SearchBar onSearch={onSearch} loading={loading} initialValue={initialValue} />
      {showHint && (
        <p style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center' }}>
          Search in: Islamabad, Rawalpindi
          <br />
          e.g. &ldquo;10 Marla plot in Islamabad under 2.5 Crore&rdquo;
        </p>
      )}
    </div>
  );
}

// HOMEPAGE REDESIGN — real counts only, never a per-card "Just getting
// started" placeholder. Three cards each showing the same empty-state text
// side by side read as a broken product, not an honest early one, so the
// fallback below only fires when every count is genuinely zero — never for a
// small-but-real count (8 societies stays "8 societies…", it never falls
// back just because the number is modest).
//
// ASSUMPTION (flagged per the brief's own rule for unmatched copy): the
// brief's third line reads "Z cities with active material rates", but no
// existing backend field measures that — cities_covered (PlatformStatsResponse)
// is PropertyIntelligenceService.listDistinctCities(), i.e. distinct society
// cities, not cities with material-rate activity, and there's no cross-
// referenced count of the two. Labeling it "material rates" would be a false
// claim next to this same page's "No fabricated data" trust-strip item, so
// this uses the honest label for the real field instead: "cities covered".
function StatCardsRow({ stats }: { stats: PlatformStatsResponse | null }) {
  if (!stats) return null;

  const allZero =
    stats.verified_societies_count === 0 && stats.total_evidence_count === 0 && stats.cities_covered.length === 0;

  if (allZero) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
        Deep coverage starting in Islamabad &amp; Rawalpindi.{' '}
        {/* Founder decision (correction to original brief): "Request a
            society" overpromised against its actual destination since no
            request-flow route exists — /browse is the nearest existing page
            to see what's covered, so the link text says that instead. */}
        <Link href="/browse" style={{ fontWeight: 600, color: 'var(--brand)' }}>
          Explore what&rsquo;s available →
        </Link>
      </p>
    );
  }

  const items: {
    icon: ComponentType<LucideProps>;
    color: string;
    count: number;
    phrase: string;
    href?: string;
    aria: string;
  }[] = [
    {
      icon: Building2,
      color: ACCENT_BLUE,
      count: stats.verified_societies_count,
      phrase: 'societies with evidence profiles',
      href: '/browse',
      aria: 'Browse verified societies',
    },
    {
      icon: FileCheck,
      color: TRUST_GREEN,
      count: stats.total_evidence_count,
      phrase: 'verified observations',
      aria: 'Evidence items on record',
    },
    {
      icon: MapPin,
      color: WARNING_AMBER,
      count: stats.cities_covered.length,
      phrase: 'cities covered',
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
              minWidth: 0,
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
            {/* minWidth: 0 — without it, a flex child defaults to its content's
                min-content size (the longest unbreakable word), which can force
                this whole grid track wider than its minmax() minimum and
                overflow the viewport on narrow phones instead of wrapping. */}
            <span style={{ minWidth: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.35 }}>
              <strong style={{ fontSize: '16px', fontWeight: 800 }}>{item.count.toLocaleString()}</strong>{' '}
              {item.phrase}
            </span>
          </div>
        );
        return item.href ? (
          <Link
            key={item.phrase}
            href={item.href}
            aria-label={item.aria}
            style={{ minWidth: 0, color: 'inherit', textDecoration: 'none' }}
          >
            {card}
          </Link>
        ) : (
          <div key={item.phrase} style={{ minWidth: 0 }}>
            {card}
          </div>
        );
      })}
    </div>
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

      <HeroBand />

      <StatCardsRow stats={stats} />

      {/* HOMEPAGE REDESIGN — down from six equal-weight cards to the two
          highest-value pillars plus the methodology card the hero's "See how
          we verify" link scrolls to. Contractors/Suppliers/House Plans move
          out of the primary homepage per the brief; their pages are
          untouched and still reachable directly (e.g. from Browse). */}
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
          title="Compare Societies"
          subtitle="See societies side by side"
          ariaLabel="Compare societies"
        />
        <QuickAccessCard
          href="/construction-estimate"
          icon={Building2}
          title="Cost Estimate"
          subtitle="Full material + works BOQ"
          ariaLabel="Construction cost estimate"
        />
        <QuickAccessCard
          id="how-we-verify"
          icon={ShieldCheck}
          title="How We Verify"
          subtitle="Evidence behind every claim"
          ariaLabel="How Siraat verifies societies"
        />
      </div>

      {/* TOOLS PAGE (P2, corrected) — a left accent bar + readable text keep
          this legible without promoting it to a card: no background fill,
          no border-radius, no shadow, just a line with an accent, still
          visually lighter-weight than the three primary cards above it. */}
      <div style={{ width: '100%', maxWidth: '720px', display: 'flex', justifyContent: 'center' }}>
        <p
          style={{
            borderLeft: `3px solid ${TRUST_GREEN}`,
            paddingLeft: '14px',
            margin: 0,
            fontSize: '13px',
            color: 'var(--text)',
            textAlign: 'left',
          }}
        >
          Looking for contractors, suppliers or house plans?
          <br />
          <Link
            href="/tools"
            className="tools-link"
            style={{ fontSize: '13px', fontWeight: 600, color: TRUST_GREEN }}
          >
            Browse Tools →
          </Link>
        </p>
      </div>

      <SecondarySearch
        onSearch={handleSearch}
        loading={loading}
        initialValue={searchParams.get('q') ?? ''}
        showHint={!result && !loading && !error}
      />

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
