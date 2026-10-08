'use client';

import { Suspense, useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import {
  Scale,
  Building2,
  ShieldCheck,
  Check,
  FileCheck,
  MapPin,
  HardHat,
  Package,
  Home,
  LandPlot,
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

// The five things most visitors come for, shown first. "Estimate Build Cost"
// appears here once only (it used to repeat as a second "Cost Estimate" card).
const PRIMARY_TOOLS: {
  href: string;
  title: string;
  subtitle: string;
  color: string;
  icon: ComponentType<LucideProps>;
}[] = [
  { href: '/plots', title: 'Plots for Sale', subtitle: 'Browse listings', color: '#7c3aed', icon: LandPlot },
  { href: ESTIMATE_BUILD_COST_HREF, title: 'Estimate Build Cost', subtitle: 'Step-by-step cost and BOQ', color: WARNING_AMBER, icon: Building2 },
  { href: '/contractors', title: 'Contractors', subtitle: 'Find verified builders', color: TRUST_GREEN, icon: HardHat },
  { href: '/suppliers', title: 'Suppliers', subtitle: 'Materials and rates', color: ACCENT_BLUE, icon: Package },
  { href: '/house-plans', title: 'House Plans', subtitle: 'Designs by plot size', color: '#db2777', icon: Home },
];

const TOOL_GRID_CSS = `
.tool-grid{display:grid;grid-template-columns:1fr;gap:12px;width:100%}
.tool-tile{display:flex;flex-direction:row;align-items:center;gap:14px;padding:16px;background:color-mix(in srgb,var(--c) 8%,#fff);border:1.5px solid color-mix(in srgb,var(--c) 35%,#fff);border-left:6px solid var(--c);border-radius:14px;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .15s,box-shadow .15s}
.tool-tile:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.12)}
.tool-icon{width:48px;height:48px;border-radius:12px;background:#fff;border:1px solid color-mix(in srgb,var(--c) 30%,#fff);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tool-body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.tool-title{font-size:16px;font-weight:800;color:var(--c);line-height:1.25}
.tool-sub{font-size:13px;font-weight:500;color:var(--muted);line-height:1.4}
.tool-arrow{color:var(--c);font-weight:800;font-size:18px}
@media(min-width:600px){
.tool-grid{grid-template-columns:repeat(2,1fr);gap:14px}
.tool-tile:first-child{grid-column:span 2}
}
@media(min-width:900px){
.tool-grid{grid-template-columns:repeat(6,1fr);gap:16px}
.tool-tile:first-child{grid-column:span 3}
.tool-tile:nth-child(2){grid-column:span 3}
.tool-tile:nth-child(n+3){grid-column:span 2}
.tool-tile{flex-direction:column;align-items:flex-start;padding:20px;gap:12px;border-left-width:1.5px;border-top:6px solid var(--c)}
.tool-icon{width:56px;height:56px}
.tool-title{font-size:18px}
.tool-sub{font-size:14px}
.tool-arrow{position:absolute;top:18px;right:18px}.tool-tile{position:relative}
}
`;

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
        maxWidth: '960px',
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${TRUST_GREEN_BORDER}`,
      }}
    >
      <div
        style={{
          background: TRUST_GREEN_BG,
          padding: '40px 20px 32px',
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

        <style>{TOOL_GRID_CSS}</style>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
          <div className="tool-grid">
            {PRIMARY_TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className="tool-tile"
                  aria-label={t.title}
                  style={{ ['--c' as string]: t.color } as CSSProperties}
                >
                  <span className="tool-icon">
                    <Icon size={26} color={t.color} aria-hidden="true" />
                  </span>
                  <span className="tool-body">
                    <span className="tool-title">{t.title}</span>
                    <span className="tool-sub">{t.subtitle}</span>
                  </span>
                  <span className="tool-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
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
    // REDESIGN — same soft gradient panel treatment as the "Looking for
    // something else?" quick-links strip above it (dc344e8), so the two
    // secondary-but-important sections read as a matched pair rather than
    // one bold panel followed by a plain, easy-to-miss line.
    <div
      style={{
        width: '100%',
        maxWidth: '640px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '20px',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.lg,
      }}
    >
      <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
        Or search a specific property
      </p>
      <SearchBar onSearch={onSearch} loading={loading} initialValue={initialValue} />
      {showHint && (
        <p style={{ color: 'var(--muted)', fontSize: '12px', textAlign: 'center', margin: 0 }}>
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

      {/* REDESIGN — same soft gradient panel treatment as the "Looking for
          something else?" and "Or search a specific property" strips below
          (dc344e8, 27a6efc), so all three secondary sections read as a
          matched set instead of this one being plain page background
          between two colorful panels. Cards/text inside stay on white, the
          same contrast pattern the quick-link pills use against their panel. */}
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '20px',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 50%, #fffbeb 100%)',
          border: '1px solid var(--border)',
          borderRadius: RADIUS.lg,
        }}
      >
        <StatCardsRow stats={stats} />

        {/* HOMEPAGE REDESIGN — down from six equal-weight cards to the two
            highest-value pillars plus the methodology card the hero's "See how
            we verify" link scrolls to. Contractors/Suppliers/House Plans move
            out of the primary homepage per the brief; their pages are
            untouched and still reachable directly (e.g. from Browse). */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            justifyContent: 'center',
          }}
        >
        <QuickAccessCard
          href={compareHref}
          icon={Scale}
          title="Compare Societies"
          subtitle="See societies side by side"
          ariaLabel="Compare societies"
          tint={ACCENT_BLUE}
        />
        <QuickAccessCard
          href={CHECK_SOCIETY_HREF}
          icon={MapPin}
          title="Check a Society"
          subtitle="Browse verified societies"
          ariaLabel="Check a society"
          tint={TRUST_GREEN}
        />
        <QuickAccessCard
          id="how-we-verify"
          icon={ShieldCheck}
          title="How We Verify"
          subtitle="Evidence behind every claim"
          ariaLabel="How Siraat verifies societies"
          tint={TRUST_GREEN}
        />
        </div>
      </div>

    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HomeView />
    </Suspense>
  );
}
