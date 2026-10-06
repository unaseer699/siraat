'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PropertyListingSummary, PropertyListingFacets } from '@siraat/shared-types';
import { CANONICAL_CITY_OPTIONS } from '@/app/admin/constants';
import { fetchPropertyListings } from '@/lib/api';
import { BackLink } from '@/components/BackLink';
import { Spinner } from '@/components/Spinner';
import { PlotListingCard, ListingDisclaimer } from '@/components/PlotListings';

const PAGE_SIZE = 30;

type SortKey = 'newest' | 'price_asc' | 'price_desc';

const controlStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};

function PlotsView() {
  const router = useRouter();
  const sp = useSearchParams();
  const city = sp.get('city') ?? '';
  const societyId = sp.get('society_id') ?? '';
  const maxPrice = sp.get('max_price_lac') ?? '';
  const minSize = sp.get('min_size_marla') ?? '';

  const [sort, setSort] = useState<SortKey>('newest');
  const [facets, setFacets] = useState<PropertyListingFacets | null>(null);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [listings, setListings] = useState<PropertyListingSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPropertyListings({
      city: city || undefined,
      society_id: societyId || undefined,
      max_price_lac: maxPrice ? Number(maxPrice) : undefined,
      min_size_marla: minSize ? Number(minSize) : undefined,
    })
      .then((r) => {
        if (cancelled) return;
        setListings(r.listings);
        setFacets(r.facets);
        setVisible(PAGE_SIZE);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load plots'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [city, societyId, maxPrice, minSize]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/plots${params.toString() ? `?${params}` : ''}`);
  }

  // Every city: the full canonical list plus any city a listing actually
  // carries, so a visitor can pick any city, not just ones with plots today.
  const cityOptions = useMemo(
    () => [...new Set([...CANONICAL_CITY_OPTIONS, ...(facets?.cities ?? [])])].sort(),
    [facets],
  );

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (listings ?? []).filter(
      (l) =>
        !q ||
        l.plot_number.toLowerCase().includes(q) ||
        (l.block ?? '').toLowerCase() === q ||
        `${l.block ?? ''}${l.plot_number}`.toLowerCase().includes(q),
    );
    if (sort === 'price_asc') rows.sort((a, b) => (a.price_lac ?? Infinity) - (b.price_lac ?? Infinity));
    if (sort === 'price_desc') rows.sort((a, b) => (b.price_lac ?? -Infinity) - (a.price_lac ?? -Infinity));
    return rows;
  }, [listings, sort]);

  // Group by society so a visitor scanning one project sees its plots together.
  const shown = sorted.slice(0, visible);
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; ref: string | null; items: PropertyListingSummary[] }>();
    for (const l of shown) {
      const key = l.society_ref ?? `raw:${l.society_name_raw.toLowerCase()}`;
      const g = map.get(key) ?? { name: l.society_name ?? l.society_name_raw, ref: l.society_ref, items: [] };
      g.items.push(l);
      map.set(key, g);
    }
    return [...map.values()];
  }, [shown]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>PLOTS FOR SALE</p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Available Plots</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {listings ? `${listings.length} plot${listings.length === 1 ? '' : 's'} listed` : 'Loading…'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="City" value={city} onChange={(e) => setParam('city', e.target.value)} style={controlStyle}>
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Society" value={societyId} onChange={(e) => setParam('society_id', e.target.value)} style={controlStyle}>
            <option value="">All societies</option>
            {(facets?.societies ?? []).map((so) => (
              <option key={so.key} value={so.key}>{so.name} ({so.count})</option>
            ))}
          </select>
          <select aria-label="Maximum price" value={maxPrice} onChange={(e) => setParam('max_price_lac', e.target.value)} style={controlStyle}>
            <option value="">Any price</option>
            {[30, 50, 75, 100, 150, 250].map((p) => (
              <option key={p} value={p}>Up to {p >= 100 ? `${p / 100} Crore` : `${p} Lac`}</option>
            ))}
          </select>
          <select aria-label="Minimum size" value={minSize} onChange={(e) => setParam('min_size_marla', e.target.value)} style={controlStyle}>
            <option value="">Any size</option>
            {[5, 10, 20].map((m) => (
              <option key={m} value={m}>{m}+ Marla</option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ ...controlStyle, marginLeft: 'auto' }}>
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>

        <input
          aria-label="Search plot number"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Search plot number, e.g. 7473"
          style={{ ...controlStyle, width: '100%' }}
        />

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading && !listings ? (
          <Spinner label="Loading plots…" />
        ) : listings && listings.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No plots match these filters right now. Listings are refreshed daily — check back soon, or{' '}
            <Link href="/browse" style={{ color: '#2563eb', fontWeight: 600 }}>browse verified societies</Link>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            {groups.map((g) => (
              <section key={g.ref ?? g.name} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 800 }}>
                  {g.ref ? (
                    <Link href={`/society/${g.ref}`} style={{ color: 'inherit' }}>{g.name} →</Link>
                  ) : (
                    g.name
                  )}{' '}
                  <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: '13px' }}>({g.items.length})</span>
                </h2>
                {g.items.map((l) => (
                  <PlotListingCard key={l.id} listing={l} />
                ))}
              </section>
            ))}
          </div>
        )}

        {sorted.length > visible && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            style={{ alignSelf: 'center', padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Show more ({sorted.length - visible} remaining)
          </button>
        )}

        <ListingDisclaimer />
      </div>
    </main>
  );
}

export default function PlotsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <PlotsView />
    </Suspense>
  );
}
