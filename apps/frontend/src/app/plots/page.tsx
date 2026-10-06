'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PropertyPlotGroup, PropertyListingFacets, GroundConditionsResponse } from '@siraat/shared-types';
import { CANONICAL_CITY_OPTIONS } from '@/app/admin/constants';
import { fetchPropertyListings, fetchGroundConditions, subscribeListingAlert } from '@/lib/api';
import { GroundChip } from '@/components/GroundChip';
import { BackLink } from '@/components/BackLink';
import { Spinner } from '@/components/Spinner';
import { PlotGroupCard, ListingDisclaimer } from '@/components/PlotListings';

const PAGE_SIZE = 30;

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'ppm_asc';

const controlStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  background: '#fff',
};

// Sort key for a plot's size: dimensions by area, otherwise Marla (225 sq ft).
function sizeArea(label: string | null, marla: number | null): number {
  const m = label?.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * Number(m[2]);
  return marla !== null ? marla * 225 : Number.MAX_SAFE_INTEGER;
}

function AlertPanel({ city, societyKey, maxPrice }: { city: string; societyKey: string; maxPrice: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hasFilter = Boolean(city || societyKey || maxPrice);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await subscribeListingAlert({
        phone,
        society_key: societyKey || null,
        city: city || null,
        max_price_lac: maxPrice ? Number(maxPrice) : null,
        min_size_marla: null,
      });
      setMsg({
        ok: true,
        text: r.confirmation_sent
          ? 'Alert saved. A confirmation is on its way to your WhatsApp.'
          : 'Alert saved. We could not send a WhatsApp confirmation yet — message our WhatsApp number once so alerts can reach you.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message.replace(/^API error \d+: /, '') : 'Could not save alert' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', fontWeight: 800, fontSize: '14px', color: '#1a56db', cursor: 'pointer', padding: '4px 0' }}
      >
        🔔 Alert me on WhatsApp when a plot like this is listed {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {hasFilter
              ? 'Uses the filters selected above (city, society or price).'
              : 'Pick at least one filter above first (city, society or price).'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              aria-label="Your WhatsApp number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your WhatsApp number, e.g. 0300 1234567"
              style={{ ...controlStyle, flex: 1, minWidth: '220px' }}
            />
            <button
              onClick={submit}
              disabled={busy || !hasFilter || phone.trim().length < 10}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 'var(--radius)', background: busy || !hasFilter ? 'var(--muted)' : '#1a56db', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              {busy ? 'Saving…' : 'Create alert'}
            </button>
          </div>
          {msg && <p style={{ fontSize: '13px', color: msg.ok ? '#166534' : 'var(--error)' }}>{msg.text}</p>}
          <p style={{ fontSize: '11px', color: 'var(--muted)' }}>Max 3 alerts a day. Reply STOP to any alert to unsubscribe.</p>
        </div>
      )}
    </div>
  );
}

function PlotsView() {
  const router = useRouter();
  const sp = useSearchParams();
  const city = sp.get('city') ?? '';
  const societyId = sp.get('society_id') ?? '';
  const maxPrice = sp.get('max_price_lac') ?? '';
  const size = sp.get('size') ?? '';

  const [sort, setSort] = useState<SortKey>('newest');
  const [facets, setFacets] = useState<PropertyListingFacets | null>(null);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [plots, setPlots] = useState<PropertyPlotGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Reviewed ground-condition reports, per society key (loaded lazily).
  const [ground, setGround] = useState<Record<string, GroundConditionsResponse>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPropertyListings({
      city: city || undefined,
      society_id: societyId || undefined,
      max_price_lac: maxPrice ? Number(maxPrice) : undefined,
      size: size || undefined,
    })
      .then((r) => {
        if (cancelled) return;
        setPlots(r.plots);
        setFacets(r.facets);
        setVisible(PAGE_SIZE);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load plots'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [city, societyId, maxPrice, size]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/plots${params.toString() ? `?${params}` : ''}`);
  }

  // Every city: the full canonical list plus any city a listing carries.
  const cityOptions = useMemo(
    () => [...new Set([...CANONICAL_CITY_OPTIONS, ...(facets?.cities ?? [])])].sort(),
    [facets],
  );

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (plots ?? []).filter(
      (p) => !q || p.plot_number.toLowerCase().includes(q) || `${p.block ?? ''}${p.plot_number}`.toLowerCase().includes(q),
    );
    if (sort === 'price_asc') rows.sort((a, b) => (a.min_price_lac ?? Infinity) - (b.min_price_lac ?? Infinity));
    if (sort === 'price_desc') rows.sort((a, b) => (b.min_price_lac ?? -Infinity) - (a.min_price_lac ?? -Infinity));
    if (sort === 'ppm_asc') rows.sort((a, b) => (a.min_price_per_marla_lac ?? Infinity) - (b.min_price_per_marla_lac ?? Infinity));
    return rows;
  }, [plots, sort, query]);

  // Society -> Block -> plots, so a visitor scanning one project sees each
  // block together. Computed over the visible slice only.
  const groups = useMemo(() => {
    const societies = new Map<string, { name: string; ref: string | null; blocks: Map<string, PropertyPlotGroup[]> }>();
    for (const p of sorted.slice(0, visible)) {
      const sKey = p.society_ref ?? `raw:${p.society_name_raw.toLowerCase()}`;
      const s = societies.get(sKey) ?? { name: p.society_name ?? p.society_name_raw, ref: p.society_ref, blocks: new Map() };
      const bKey = p.block ?? '';
      s.blocks.set(bKey, [...(s.blocks.get(bKey) ?? []), p]);
      societies.set(sKey, s);
    }
    // Default ("Recently confirmed") order is meaningless inside one block —
    // a whole forwarded message shares one timestamp — so list smallest size
    // first, cheapest first. An explicit sort choice is left untouched.
    if (sort === 'newest') {
      for (const s of societies.values()) {
        for (const [b, items] of s.blocks) {
          s.blocks.set(
            b,
            [...items].sort(
              (x, y) =>
                sizeArea(x.size_label, x.size_marla) - sizeArea(y.size_label, y.size_marla) ||
                (x.min_price_lac ?? Infinity) - (y.min_price_lac ?? Infinity),
            ),
          );
        }
      }
    }
    return [...societies.entries()].map(([key, s]) => ({
      key,
      name: s.name,
      ref: s.ref,
      count: [...s.blocks.values()].reduce((n, b) => n + b.length, 0),
      blocks: [...s.blocks.entries()].sort(([a], [b]) => a.localeCompare(b)),
    }));
  }, [sorted, visible, sort]);

  useEffect(() => {
    for (const g of groups) {
      if (ground[g.key]) continue;
      fetchGroundConditions(g.key)
        .then((r) => setGround((prev) => ({ ...prev, [g.key]: r })))
        .catch(() => undefined); // best effort: the chip simply stays at "no reports"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);


  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>PLOTS FOR SALE</p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Available Plots</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {plots ? `${sorted.length} plot${sorted.length === 1 ? '' : 's'} listed` : 'Loading…'}
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
          <select aria-label="Plot size" value={size} onChange={(e) => setParam('size', e.target.value)} style={controlStyle}>
            <option value="">All sizes</option>
            {(facets?.sizes ?? []).map((s) => (
              <option key={s.label} value={s.label}>{s.label} ({s.count})</option>
            ))}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ ...controlStyle, marginLeft: 'auto' }}>
            <option value="newest">Recently confirmed</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="ppm_asc">Price per marla: low to high</option>
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

        <AlertPanel city={city} societyKey={societyId} maxPrice={maxPrice} />

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading && !plots ? (
          <Spinner label="Loading plots…" />
        ) : plots && sorted.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No plots match these filters right now. Listings are refreshed daily — set an alert above, or{' '}
            <Link href="/browse" style={{ color: '#2563eb', fontWeight: 600 }}>browse verified societies</Link>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '26px', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            {groups.map((g) => (
              <section key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 800 }}>
                  {g.ref ? <Link href={`/society/${g.ref}`} style={{ color: 'inherit' }}>{g.name} →</Link> : g.name}{' '}
                  <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: '13px' }}>({g.count})</span>
                </h2>
                {g.blocks.map(([block, items]) => (
                  <div key={block} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--muted)' }}>
                      {block ? `BLOCK ${block.toUpperCase()}` : 'BLOCK NOT STATED'} · {items.length}
                    </h3>
                    {block && (
                      <GroundChip
                        summary={ground[g.key]?.blocks.find((b) => b.block === block.toUpperCase())}
                        societyName={g.name}
                        block={block}
                      />
                    )}
                    {items.map((p) => (
                      <PlotGroupCard key={p.key} plot={p} />
                    ))}
                  </div>
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
