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
  MapPin,
  HardHat,
  Package,
  Home,
  LandPlot,
  type LucideProps,
} from 'lucide-react';
import type {
  PropertyPlotGroup,
  RecommendationResponse,
  RecommendationItem,
  PlatformStatsResponse,
} from '@siraat/shared-types';
import { fetchRecommendations, fetchPlatformStats, fetchPropertyListings } from '@/lib/api';
import { parsePlotQuery, plotsPageHref } from '@/lib/queryFilters';
import { PlotMatches } from '@/components/PlotMatches';
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
            gap: '10px',
            background: `linear-gradient(135deg, ${TRUST_GREEN} 0%, #15803d 100%)`,
            borderRadius: '99px',
            padding: '8px 20px 8px 8px',
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '0.2px',
            color: '#fff',
            boxShadow: '0 3px 10px rgba(22,163,74,0.35)',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: '30px',
              height: '30px',
              flexShrink: 0,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={18} color={TRUST_GREEN} aria-hidden="true" />
          </span>
          Evidence-Backed Real Estate Intelligence
        </span>

        <header style={{ textAlign: 'center', maxWidth: '640px' }}>
          <h1 style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.05, margin: 0 }}>
            Siraat
          </h1>
          <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: '12px 0 0' }}>
            Buy with proof, not promises.
          </p>
          <p style={{ fontSize: '15px', color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
            Check society approvals, builders and costs against official records before you spend.
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

          <Link
            href="/build-guide"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '15px',
              fontWeight: 800,
              color: '#fff',
              background: TRUST_GREEN,
              borderRadius: '99px',
              padding: '12px 22px',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            Steps to build a home: plot to move-in →
          </Link>

          <Link
            href="/real-builds"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '15px',
              fontWeight: 800,
              color: '#fff',
              background: ACCENT_BLUE,
              borderRadius: '99px',
              padding: '12px 22px',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              textAlign: 'center',
            }}
          >
            See real homes being built: cost vs estimate →
          </Link>
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

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

// Real counts only, as one quiet line — never per-card placeholders. The
// labels use plain words (documents, societies, cities) instead of internal
// terms like "observations" / "evidence profiles".
function OnRecordLine({ stats }: { stats: PlatformStatsResponse | null }) {
  if (!stats) return null;

  const allZero =
    stats.verified_societies_count === 0 && stats.total_evidence_count === 0 && stats.cities_covered.length === 0;

  if (allZero) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
        Deep coverage starting in Islamabad &amp; Rawalpindi.{' '}
        <Link href="/browse" style={{ fontWeight: 600, color: 'var(--brand)' }}>
          Explore what&rsquo;s available →
        </Link>
      </p>
    );
  }

  return (
    <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
      On record today:{' '}
      <strong style={{ color: 'var(--text)' }}>{plural(stats.verified_societies_count, 'society', 'societies')}</strong>
      {' · '}
      <strong style={{ color: 'var(--text)' }}>{plural(stats.total_evidence_count, 'document', 'documents')}</strong>
      {' · '}
      <strong style={{ color: 'var(--text)' }}>{plural(stats.cities_covered.length, 'city', 'cities')}</strong>
    </p>
  );
}

const CHECK_CSS = `
.check-grid{display:grid;grid-template-columns:1fr;gap:12px;width:100%}
.check-tile{position:relative;display:flex;flex-direction:row;align-items:center;gap:14px;padding:16px;background:color-mix(in srgb,var(--c) 8%,#fff);border:1.5px solid color-mix(in srgb,var(--c) 35%,#fff);border-left:6px solid var(--c);border-radius:14px;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .15s,box-shadow .15s}
.check-tile:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.12)}
.check-icon{width:48px;height:48px;border-radius:12px;background:#fff;border:1px solid color-mix(in srgb,var(--c) 30%,#fff);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.check-body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.check-title{font-size:16px;font-weight:800;color:var(--c);line-height:1.25}
.check-sub{font-size:13px;font-weight:500;color:var(--muted);line-height:1.4}
.check-arrow{color:var(--c);font-weight:800;font-size:18px}
.how-steps{display:grid;grid-template-columns:1fr;gap:14px;margin:0;padding:0;list-style:none}
@media(min-width:700px){
.check-grid{grid-template-columns:repeat(2,1fr);gap:16px}
.how-steps{grid-template-columns:repeat(3,1fr);gap:18px}
}
`;

const CHECK_TOOLS: { href: string; title: string; subtitle: string; color: string; icon: ComponentType<LucideProps> }[] = [
  { href: CHECK_SOCIETY_HREF, title: 'Check a Society', subtitle: 'Approval status and the documents behind it', color: TRUST_GREEN, icon: MapPin },
  { href: '/compare', title: 'Compare Societies', subtitle: 'Put 2–3 societies side by side', color: ACCENT_BLUE, icon: Scale },
];

const HOW_WE_VERIFY_STEPS: { title: string; text: string }[] = [
  { title: 'Official documents', text: 'We collect NOCs, approvals and notices published by CDA, RDA and other authorities.' },
  { title: 'Human review', text: 'A person reviews every document before it is shown. Nothing is auto-published.' },
  { title: 'Honest score', text: 'Each society gets a trust score. Without a verified approval it can never score high.' },
];

function HomeView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [plotMatches, setPlotMatches] = useState<{ plots: PropertyPlotGroup[]; total: number; href: string } | null>(null);
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
    setPlotMatches(null);
    setCompareSelection([]);
    try {
      const data = await fetchRecommendations({ query_text: query });
      setResult(data);
      // No verified society matched: fall back to live plot listings that fit
      // what was typed (city / size / price). Best effort — never blocks results.
      if (data.state !== 'NOT_COVERED' && data.recommendations.length === 0) {
        const filters = parsePlotQuery(query);
        if (filters) {
          fetchPropertyListings({ city: filters.city, size: filters.size, max_price_lac: filters.max_price_lac })
            .then((r) => {
              if (r.plots.length > 0) setPlotMatches({ plots: r.plots.slice(0, 8), total: r.plots.length, href: plotsPageHref(filters) });
            })
            .catch(() => undefined);
        }
      }
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

      {plotMatches && <PlotMatches plots={plotMatches.plots} total={plotMatches.total} href={plotMatches.href} />}

      <section style={{ width: '100%', maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <style>{CHECK_CSS}</style>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Check a society before you buy</h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '4px 0 0' }}>
            See what the official records say, then compare your shortlist.
          </p>
        </div>
        <div className="check-grid">
          {CHECK_TOOLS.map((t) => {
            const Icon = t.icon;
            const href = t.href === '/compare' && compareHref ? compareHref : t.href;
            return (
              <Link key={t.href} href={href} className="check-tile" aria-label={t.title} style={{ ['--c' as string]: t.color } as CSSProperties}>
                <span className="check-icon">
                  <Icon size={26} color={t.color} aria-hidden="true" />
                </span>
                <span className="check-body">
                  <span className="check-title">{t.title}</span>
                  <span className="check-sub">{t.subtitle}</span>
                </span>
                <span className="check-arrow" aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
        <OnRecordLine stats={stats} />
      </section>

      <section
        id="how-we-verify"
        style={{
          width: '100%',
          maxWidth: '960px',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: RADIUS.lg,
          padding: '24px 20px',
          scrollMarginTop: '24px',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={22} color={TRUST_GREEN} aria-hidden="true" />
          How we verify
        </h2>
        <ol className="how-steps">
          {HOW_WE_VERIFY_STEPS.map((step, i) => (
            <li key={step.title} style={{ display: 'flex', gap: '12px' }}>
              <span
                style={{
                  flexShrink: 0,
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: TRUST_GREEN_BG,
                  border: `1px solid ${TRUST_GREEN_BORDER}`,
                  color: TRUST_GREEN_TEXT,
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </span>
              <span>
                <strong style={{ display: 'block', fontSize: '15px' }}>{step.title}</strong>
                <span style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

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
