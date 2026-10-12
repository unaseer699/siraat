'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { paginationButtonStyle } from '@/styles/pagination';
import type { SocietyListResponse, SocietyBrowseSummary } from '@siraat/shared-types';
import { fetchSocieties, fetchPlatformStats, fetchPropertyListingCounts } from '@/lib/api';
import { BackLink } from '@/components/BackLink';
import {
  TRUST_GREEN,
  WARNING_AMBER,
  DANGER_RED,
  NEUTRAL_GRAY,
  REVOKED_SLATE,
  REVOKED_SLATE_BG,
  REVOKED_SLATE_BORDER,
  RADIUS,
} from '@/styles/tokens';

const PAGE_SIZE = 20;

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

function formatRange(range: { min: number | null; max: number | null }): string {
  if (range.min === null && range.max === null) return '—';
  if (range.min !== null && range.max !== null && range.min !== range.max) {
    return `${formatPKR(range.min)} – ${formatPKR(range.max)}`;
  }
  return formatPKR(range.min ?? range.max ?? 0);
}

// Same tier/status badge pattern as society/[id]/page.tsx, extended with the
// PARTIAL (amber) and gray-PENDING treatment Browse needs to distinguish a
// society with no claims yet from one with a claim still under review.
const STATUS_META: Record<
  SocietyBrowseSummary['verification_status'],
  { color: string; bg: string; border: string; icon: string; label: string; hint: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, icon: '✓', label: 'Verified', hint: 'Approval verified with documents' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '⚠', label: 'Disputed', hint: 'Issues have been reported' },
  // EVIDENCE DOCUMENT MODEL Chunk 2 — real CANCELLED treatment (replaces
  // Chunk 1's DANGER_RED placeholder). Its own tone (REVOKED_SLATE, see
  // tokens.ts): DISPUTED is an active, ongoing conflict; CANCELLED is a
  // settled, final absence — visually distinct registers, not just a
  // different icon on the same alarm-red.
  CANCELLED: { color: REVOKED_SLATE, bg: REVOKED_SLATE_BG, border: REVOKED_SLATE_BORDER, icon: '✕', label: 'Cancelled', hint: 'Approval cancelled' },
  PARTIAL: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, icon: '…', label: 'Partial', hint: 'Some checks done, not fully verified' },
  PENDING: { color: NEUTRAL_GRAY, bg: '#f9fafb', border: `${NEUTRAL_GRAY}40`, icon: '○', label: 'Pending', hint: 'Not verified yet' },
};

function StatusBadge({ status }: { status: SocietyBrowseSummary['verification_status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span
      style={{
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        fontSize: '12px',
        fontWeight: 700,
        padding: '4px 12px',
        borderRadius: '99px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
}

function formatArea(range: { min: number | null; max: number | null }): string | null {
  const { min, max } = range;
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max) return `${Number(min)}–${Number(max)} marla`;
  return `${Number(min ?? max)} marla`;
}

function SocietyCard({ society, plotCount }: { society: SocietyBrowseSummary; plotCount: number }) {
  const meta = STATUS_META[society.verification_status] ?? STATUS_META.PENDING;
  const price = formatRange(society.price_range);
  const area = formatArea(society.area_range);
  return (
    <Link href={`/society/${society.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', height: '100%' }}>
      <article
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderLeft: `4px solid ${meta.color}`,
          borderRadius: RADIUS.md,
          padding: '16px 18px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{society.name}</h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '2px 0 0' }}>{society.city}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <StatusBadge status={society.verification_status} />
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{meta.hint}</span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0 }}>
          {price === '—' ? <span style={{ color: 'var(--muted)' }}>Price not listed</span> : <strong>{price}</strong>}
          {area && <span style={{ color: 'var(--muted)' }}> · {area}</span>}
        </p>
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
          {plotCount > 0 ? (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#1a56db',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '99px',
                padding: '3px 10px',
              }}
            >
              {plotCount} plot{plotCount === 1 ? '' : 's'} for sale
            </span>
          ) : (
            <span />
          )}
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>View details →</span>
        </div>
      </article>
    </Link>
  );
}

function BrowseView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const city = searchParams.get('city') ?? '';
  const q = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [data, setData] = useState<SocietyListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [plotCounts, setPlotCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchPlatformStats()
      .then((stats) => setCities(stats.cities_covered))
      .catch(() => {
        // City filter is a nice-to-have — leave the dropdown at "All cities" if this fails.
      });
  }, []);

  useEffect(() => {
    // Plot badges are an enrichment — silently absent if this fails.
    fetchPropertyListingCounts()
      .then((r) => setPlotCounts(r.counts))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSocieties({ city: city || undefined, q: q || undefined, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load societies');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, q, page]);

  // Debounced search: typing updates the URL (?q=) after a short pause.
  useEffect(() => {
    if (search.trim() === q) return;
    const t = setTimeout(() => updateParams({ q: search.trim(), page: 1 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // UI REVIEW finding — Prev/Next previously left the scroll position
  // wherever it was on the old page's content, so on a long list the user
  // stayed scrolled to the bottom after clicking Next. Scroll to top on
  // every page change (deliberately not on city change, which already
  // resets page to 1 via updateParams and the user is still looking at the
  // filter control they just used).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  function updateParams(next: { city?: string; q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.city !== undefined) {
      if (next.city) params.set('city', next.city);
      else params.delete('city');
    }
    if (next.q !== undefined) {
      if (next.q) params.set('q', next.q);
      else params.delete('q');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    const qs = params.toString();
    router.push(`/browse${qs ? `?${qs}` : ''}`);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 16px 32px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            BROWSE
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Housing societies</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {data ? `${data.total_count} societ${data.total_count === 1 ? 'y' : 'ies'}${q || city ? ' found' : ' on record'} · check approval status before you buy` : 'Loading…'}
          </p>
          <Link
            href="/plots"
            style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', fontWeight: 700, color: '#1a56db' }}
          >
            See plots for sale →
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by society name…"
            aria-label="Search societies by name"
            style={{
              flex: '1 1 240px',
              minWidth: 0,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              background: '#fff',
            }}
          />
          <select
            aria-label="City"
            value={city}
            onChange={(e) => updateParams({ city: e.target.value, page: 1 })}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '14px',
              background: '#fff',
            }}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            style={{
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

        {loading && !data ? (
          <Spinner label="Loading societies…" />
        ) : data && data.societies.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {q || city ? `No societies match${q ? ` “${q}”` : ''}${city ? ` in ${city}` : ''}.` : 'No societies on record yet.'}
          </p>
        ) : data ? (
          // UI REVIEW finding — a page change previously swapped the whole
          // grid + Prev/Next controls out for plain "Loading…" text, so the
          // controls disappeared and reappeared on every click (layout
          // jump). Keep the stale page's content visible, dimmed, with a
          // spinner overlay instead, so the controls stay put.
          <div style={{ position: 'relative' }}>
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
              >
                <Spinner />
              </div>
            )}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {data.societies.map((s) => (
                <SocietyCard key={s.id} society={s} plotCount={plotCounts[s.id] ?? 0} />
              ))}
            </div>

            {data.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                <button
                  onClick={() => updateParams({ page: page - 1 })}
                  disabled={page <= 1}
                  style={paginationButtonStyle(page <= 1)}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Page {data.page} of {data.total_pages}
                </span>
                <button
                  onClick={() => updateParams({ page: page + 1 })}
                  disabled={page >= data.total_pages}
                  style={paginationButtonStyle(page >= data.total_pages)}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BrowseView />
    </Suspense>
  );
}
