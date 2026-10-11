'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { paginationButtonStyle } from '@/styles/pagination';
import type { HousePlanListResponse } from '@siraat/shared-types';
import { fetchHousePlans } from '@/lib/api';
import { HOUSE_PLAN_STYLE_OPTIONS } from '@/lib/housePlanStyles';
import { HousePlanImage } from '@/components/HousePlanImage';
import { BackLink } from '@/components/BackLink';
import { RADIUS } from '@/styles/tokens';

const PAGE_SIZE = 20;

// Fixed options rather than a free-text field — mirrors the categorical
// filters elsewhere (suppliers/page.tsx's material dropdown) rather than
// exposing a numeric range as two separate inputs.
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5, 6];

function styleLabel(value: string): string {
  return HOUSE_PLAN_STYLE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

function HousePlanCard({ plan }: { plan: HousePlanListResponse['house_plans'][number] }) {
  return (
    <Link href={`/house-plan/${plan.id}`} style={{ display: 'flex', height: '100%', textDecoration: 'none', color: 'inherit' }}>
      <article
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: RADIUS.md,
          overflow: 'hidden',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <HousePlanImage housePlanId={plan.id} hasImage={Boolean(plan.preview_image_ref)} alt={plan.title} />

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
          {/* Two lines reserved for every title so the badges line up across cards. */}
          <h3
            title={plan.title}
            style={{
              fontSize: '16px',
              fontWeight: 700,
              lineHeight: 1.35,
              minHeight: '2.7em',
              color: 'var(--text)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {plan.title}
          </h3>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
            <span style={badgeStyle}>{plan.area_marla} Marla</span>
            <span style={badgeStyle}>
              {plan.bedrooms} Bed{plan.bedrooms === 1 ? '' : 's'}
            </span>
            <span style={badgeStyle}>{styleLabel(plan.style)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

const badgeStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--muted)',
  border: '1px solid var(--border)',
  padding: '2px 8px',
  borderRadius: '99px',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};


function HousePlansView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaMin = searchParams.get('area_min') ?? '';
  const areaMax = searchParams.get('area_max') ?? '';
  const bedrooms = searchParams.get('bedrooms') ?? '';
  const style = searchParams.get('style') ?? '';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [data, setData] = useState<HousePlanListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHousePlans({
      area_marla_min: areaMin ? Number(areaMin) : undefined,
      area_marla_max: areaMax ? Number(areaMax) : undefined,
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      style: style || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load house plans');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [areaMin, areaMax, bedrooms, style, page]);

  // UI REVIEW finding — scroll to top on every page change, matching
  // browse/page.tsx; see its comment for why not on filter change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  function updateParams(next: {
    area_min?: string;
    area_max?: string;
    bedrooms?: string;
    style?: string;
    page?: number;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ['area_min', 'area_max', 'bedrooms', 'style'] as const) {
      if (next[key] !== undefined) {
        if (next[key]) params.set(key, next[key]!);
        else params.delete(key);
      }
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    const qs = params.toString();
    router.push(`/house-plans${qs ? `?${qs}` : ''}`);
  }

  const hasFilters = Boolean(areaMin || areaMax || bedrooms || style);

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
            HOUSE PLANS DIRECTORY
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Browse House Plans</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {data ? `${data.total_count} plan${data.total_count === 1 ? '' : 's'} on record` : 'Loading…'} —
            directory only, no download or payment
          </p>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Area (Marla)</label>
            <input
              type="number"
              min="0"
              placeholder="Min"
              value={areaMin}
              onChange={(e) => updateParams({ area_min: e.target.value, page: 1 })}
              style={{ ...selectStyle, width: '80px' }}
            />
            <span style={{ color: 'var(--muted)' }}>–</span>
            <input
              type="number"
              min="0"
              placeholder="Max"
              value={areaMax}
              onChange={(e) => updateParams({ area_max: e.target.value, page: 1 })}
              style={{ ...selectStyle, width: '80px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Bedrooms</label>
            <select
              value={bedrooms}
              onChange={(e) => updateParams({ bedrooms: e.target.value, page: 1 })}
              style={selectStyle}
            >
              <option value="">Any</option>
              {BEDROOM_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}+
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Style</label>
            <select
              value={style}
              onChange={(e) => updateParams({ style: e.target.value, page: 1 })}
              style={selectStyle}
            >
              <option value="">All styles</option>
              {HOUSE_PLAN_STYLE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
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
          <Spinner label="Loading house plans…" />
        ) : data && data.house_plans.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {hasFilters ? 'No house plans match these filters.' : 'No house plans on record yet.'}
          </p>
        ) : data ? (
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
                gridAutoRows: '1fr',
                gap: '16px',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {data.house_plans.map((p) => (
                <HousePlanCard key={p.id} plan={p} />
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

export default function HousePlansPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HousePlansView />
    </Suspense>
  );
}
