'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { PropertyPlotGroup, PropertyListingFacets, GroundConditionsResponse } from '@siraat/shared-types';
import { fetchPropertyListings, fetchGroundConditions, subscribeListingAlert } from '@/lib/api';
import { GroundChip } from '@/components/GroundChip';
import { BackLink } from '@/components/BackLink';
import { Spinner } from '@/components/Spinner';
import { PlotGroupCard, ListingDisclaimer, formatLac } from '@/components/PlotListings';

const PAGE_SIZE = 30;

const PLOTS_CSS = `
.pl-bar{display:flex;flex-wrap:wrap;gap:10px}
.pl-pills{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.pl-grid{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:760px){.pl-grid{grid-template-columns:1fr 1fr}}
.pl-block summary{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;cursor:pointer;list-style:none;padding:10px 12px;background:#f3f4f6;border-radius:10px;margin-bottom:10px}
.pl-block summary::-webkit-details-marker{display:none}
.pl-block summary::before{content:'▾';margin-right:8px;color:var(--muted)}
.pl-block:not([open]) summary::before{content:'▸'}
.pl-block summary>span:first-child{margin-right:auto}
`;

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
  const [open, setOpen] = useState(true);
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
  const [alertOpen, setAlertOpen] = useState(false);
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
      const sKey = p.society_key;
      const s = societies.get(sKey) ?? { name: p.society_name ?? p.society_display, ref: p.society_ref, blocks: new Map() };
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


  const PRICE_PILLS = [
    { v: '50', label: 'Up to 50 Lac' },
    { v: '100', label: 'Up to 1 Crore' },
    { v: '150', label: 'Up to 1.5 Crore' },
    { v: '250', label: 'Up to 2.5 Crore' },
  ];
  const sizeFacets = facets?.sizes ?? [];
  const societyName = facets?.societies.find((so) => so.key === societyId)?.name ?? '';
  const anyFilter = Boolean(city || societyId || maxPrice || size || query);

  const priced = sorted.map((p) => p.min_price_lac).filter((x): x is number => x !== null);
  const sizeRange = (() => {
    const present = new Set(sorted.map((p) => p.size_category).filter((x): x is string => Boolean(x)));
    const labels = (facets?.sizes ?? []).map((x) => x.label).filter((l) => present.has(l));
    return labels.length === 0 ? '' : labels.length <= 3 ? labels.join(' · ') : `${labels[0]} to ${labels[labels.length - 1]}`;
  })();

  const pill = (active: boolean): React.CSSProperties => ({
    flex: '0 0 auto',
    fontSize: '14px',
    fontWeight: 700,
    padding: '8px 14px',
    minHeight: '38px',
    borderRadius: '99px',
    border: `1.5px solid ${active ? '#1a56db' : 'var(--border)'}`,
    background: active ? '#1a56db' : '#fff',
    color: active ? '#fff' : '#111827',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 32px' }}>
      <style>{PLOTS_CSS}</style>
      <div style={{ width: '100%', maxWidth: '980px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>PLOTS FOR SALE</p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Available Plots</h1>
        </div>

        <div className="pl-bar">
          <input
            aria-label="Search plot number"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search plot number, e.g. 7473"
            style={{ ...controlStyle, flex: '2 1 220px', padding: '10px 12px' }}
          />
          <select
            aria-label="City"
            value={city}
            onChange={(e) => {
              const params = new URLSearchParams(sp.toString());
              if (e.target.value) params.set('city', e.target.value);
              else params.delete('city');
              params.delete('society_id');
              router.push(`/plots${params.toString() ? `?${params}` : ''}`);
            }}
            style={{ ...controlStyle, flex: '1 1 140px', padding: '10px 12px' }}
          >
            <option value="">All cities</option>
            {(facets?.cities ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Society" value={societyId} onChange={(e) => setParam('society_id', e.target.value)} style={{ ...controlStyle, flex: '1 1 180px', padding: '10px 12px' }}>
            <option value="">{city ? `All societies in ${city}` : 'All societies'}</option>
            {(facets?.societies ?? [])
              .filter((so) => !city || (so.city ?? '').toLowerCase() === city.toLowerCase())
              .map((so) => (
              <option key={so.key} value={so.key}>{so.name} ({so.count})</option>
            ))}
          </select>
        </div>

        <div className="pl-pills" role="group" aria-label="Plot size">
          <button style={pill(!size)} onClick={() => setParam('size', '')}>All sizes</button>
          {sizeFacets.map((sf) => (
            <button key={sf.label} style={pill(size === sf.label)} onClick={() => setParam('size', size === sf.label ? '' : sf.label)} title={sf.aliases?.join(', ')}>
              {sf.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>{sf.count}</span>
            </button>
          ))}
        </div>

        <div className="pl-pills" role="group" aria-label="Maximum price">
          <button style={pill(!maxPrice)} onClick={() => setParam('max_price_lac', '')}>Any price</button>
          {PRICE_PILLS.map((pp) => (
            <button key={pp.v} style={pill(maxPrice === pp.v)} onClick={() => setParam('max_price_lac', maxPrice === pp.v ? '' : pp.v)}>
              {pp.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px 14px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
            {plots ? (
              <>
                <strong style={{ color: '#111827' }}>{sorted.length} plot{sorted.length === 1 ? '' : 's'}</strong>
                {sizeRange ? ` · ${sizeRange}` : ''}
                {priced.length > 0 ? ` · ${formatLac(Math.min(...priced))} to ${formatLac(Math.max(...priced))}` : ''}
              </>
            ) : (
              'Loading…'
            )}
            {city && (
              <button onClick={() => setParam('city', '')} style={{ ...pill(false), marginLeft: '8px', minHeight: '28px', padding: '2px 10px', fontSize: '12px' }}>
                {city} ✕
              </button>
            )}
            {anyFilter && (
              <button
                onClick={() => {
                  setQuery('');
                  router.push('/plots');
                }}
                style={{ background: 'none', border: 'none', color: '#1a56db', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginLeft: '8px' }}
              >
                Clear all
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setAlertOpen((o) => !o)} style={{ ...pill(alertOpen), minHeight: '36px' }}>
              🔔 Alerts
            </button>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={controlStyle}>
              <option value="newest">Recently confirmed</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="ppm_asc">Per marla: low to high</option>
            </select>
          </div>
        </div>

        {alertOpen && <AlertPanel city={city} societyKey={societyId} maxPrice={maxPrice} />}

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', color: 'var(--error)', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {loading && !plots ? (
          <Spinner label="Loading plots…" />
        ) : plots && sorted.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No plots match these filters right now. Listings are refreshed daily. Try clearing a filter, set an alert, or{' '}
            <Link href="/browse" style={{ color: '#2563eb', fontWeight: 600 }}>browse verified societies</Link>.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
            {groups.map((g) => {
              const missing = g.blocks
                .map(([b]) => b)
                .filter((b) => b && !ground[g.key]?.blocks.find((x) => x.block === b.toUpperCase()));
              return (
                <section key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h2 style={{ fontSize: '19px', fontWeight: 800 }}>
                    {g.ref ? <Link href={`/society/${g.ref}`} style={{ color: 'inherit' }}>{g.name} →</Link> : g.name}{' '}
                    <span style={{ fontWeight: 600, color: 'var(--muted)', fontSize: '14px' }}>({g.count})</span>
                  </h2>
                  {missing.length > 0 && (
                    <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      No ground reports yet for {missing.length === 1 ? 'block' : 'blocks'} {missing.map((b) => b.toUpperCase()).join(', ')}.{' '}
                      <Link href={`/report-ground?society=${encodeURIComponent(g.name)}`} style={{ color: '#1a56db', fontWeight: 600 }}>
                        Built here? Report what you found →
                      </Link>
                    </p>
                  )}
                  {g.blocks.map(([block, items]) => {
                    const ps = items.map((i) => i.min_price_lac).filter((x): x is number => x !== null);
                    return (
                      <details key={block} open className="pl-block">
                        <summary>
                          <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.03em' }}>
                            {block ? `BLOCK ${block.toUpperCase()}` : 'BLOCK NOT STATED'}
                          </span>
                          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
                            {items.length} plot{items.length === 1 ? '' : 's'}
                            {ps.length > 0 ? ` · ${formatLac(Math.min(...ps))}${Math.min(...ps) === Math.max(...ps) ? '' : ` to ${formatLac(Math.max(...ps))}`}` : ''}
                          </span>
                        </summary>
                        {block && (
                          <div style={{ margin: '8px 0 10px' }}>
                            <GroundChip
                              summary={ground[g.key]?.blocks.find((b) => b.block === block.toUpperCase())}
                              societyName={g.name}
                              block={block}
                            />
                          </div>
                        )}
                        <div className="pl-grid">
                          {items.map((p) => (
                            <PlotGroupCard key={p.key} plot={p} />
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}

        {sorted.length > visible && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            style={{ alignSelf: 'center', padding: '12px 24px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff', fontWeight: 700, cursor: 'pointer' }}
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
