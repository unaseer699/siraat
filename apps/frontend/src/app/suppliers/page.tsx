'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { paginationButtonStyle } from '@/styles/pagination';
import type { SupplierListResponse, SocietyVerificationStatus } from '@siraat/shared-types';
import { fetchSuppliers, fetchPlatformStats } from '@/lib/api';
import { MATERIAL_CATEGORY_OPTIONS } from '@/lib/materialCategories';
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

const PAGE_SIZE = 24;

// Same badge treatment as contractors/page.tsx's StatusBadge — VERIFIED/
// PARTIAL/PENDING/DISPUTED is the same claim-derived status Society Browse
// uses, just derived from a Supplier's claims instead (TrustService, reused).
const STATUS_META: Record<
  SocietyVerificationStatus,
  { color: string; bg: string; border: string; icon: string; label: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, icon: '✓', label: 'Verified' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '⚠', label: 'Disputed' },
  // EVIDENCE DOCUMENT MODEL Chunk 2 — see browse/page.tsx's STATUS_META for
  // why CANCELLED gets its own REVOKED_SLATE tone rather than DANGER_RED.
  CANCELLED: { color: REVOKED_SLATE, bg: REVOKED_SLATE_BG, border: REVOKED_SLATE_BORDER, icon: '✕', label: 'Cancelled' },
  PARTIAL: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, icon: '…', label: 'Partial' },
  PENDING: { color: NEUTRAL_GRAY, bg: '#f9fafb', border: `${NEUTRAL_GRAY}40`, icon: '○', label: 'Pending' },
};

function StatusBadge({ status }: { status: SocietyVerificationStatus }) {
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

function materialLabel(value: string): string {
  return MATERIAL_CATEGORY_OPTIONS.find((m) => m.value === value)?.label ?? value;
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#0d9488', '#b45309', '#be123c', '#4f46e5', '#0891b2', '#65a30d'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

const MAX_CHIPS = 3;

function SupplierCard({ supplier }: { supplier: SupplierListResponse['suppliers'][number] }) {
  const shown = supplier.material_categories.slice(0, MAX_CHIPS);
  const extra = supplier.material_categories.length - shown.length;
  const color = avatarColor(supplier.name);
  const call = supplier.contact_phone.replace(/[^\d+]/g, '');
  const wa = (supplier.contact_whatsapp ?? '').replace(/\D/g, '');
  return (
    <article className="supplier-card">
      <Link href={`/supplier/${supplier.id}`} className="supplier-card-link" aria-label={`Open ${supplier.name}`} />
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div
          aria-hidden
          style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}18`, color, fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {initials(supplier.name)}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.25 }}>{supplier.name}</h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '3px 0 0' }}>📍 {supplier.service_cities.join(', ')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge status={supplier.verification_status} />
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {shown.map((m) => (
          <span key={m} style={{ fontSize: '12px', fontWeight: 600, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: '99px' }}>
            {materialLabel(m)}
          </span>
        ))}
        {extra > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', background: '#f3f4f6', padding: '3px 10px', borderRadius: '99px' }}>+{extra} more</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', position: 'relative', zIndex: 2 }}>
        {call && (
          <a href={`tel:${call}`} className="supplier-action" style={{ color: '#111', borderColor: '#d1d5db' }}>
            Call
          </a>
        )}
        {wa && (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="supplier-action" style={{ color: TRUST_GREEN, borderColor: `${TRUST_GREEN}60` }}>
            WhatsApp
          </a>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', alignSelf: 'center' }}>View →</span>
      </div>
    </article>
  );
}

const LIST_CSS = `
.supplier-card { position: relative; background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: box-shadow .15s, transform .15s, border-color .15s; height: 100%; }
.supplier-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.10); transform: translateY(-2px); border-color: #cbd5e1; }
.supplier-card-link { position: absolute; inset: 0; z-index: 1; border-radius: 14px; }
.supplier-action { font-size: 13px; font-weight: 600; border: 1px solid; border-radius: 8px; padding: 6px 14px; text-decoration: none; background: #fff; }
.supplier-action:hover { background: #f9fafb; }
.supplier-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
.supplier-chip { flex-shrink: 0; font-size: 13px; font-weight: 600; padding: 6px 14px; border-radius: 99px; border: 1px solid var(--border); background: #fff; color: var(--text); cursor: pointer; white-space: nowrap; }
.supplier-chip:hover { background: #f3f4f6; }
.supplier-chip[aria-pressed="true"] { background: #111; color: #fff; border-color: #111; }
`;

function SuppliersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const material = searchParams.get('material') ?? '';
  const city = searchParams.get('city') ?? '';
  const q = searchParams.get('q') ?? '';
  const [qInput, setQInput] = useState(q);
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [data, setData] = useState<SupplierListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    fetchPlatformStats()
      .then((stats) => setCities(stats.cities_covered))
      .catch(() => {
        // City filter is a nice-to-have — leave the dropdown at "All cities" if this fails.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSuppliers({ material_category: material || undefined, city: city || undefined, q: q || undefined, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load suppliers');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [material, city, q, page]);

  // UI REVIEW finding — scroll to top on every page change, matching
  // browse/page.tsx; see its comment for why not on filter change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // Search as you type, after a short pause.
  useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => updateParams({ q: qInput, page: 1 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  function updateParams(next: { material?: string; city?: string; q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.material !== undefined) {
      if (next.material) params.set('material', next.material);
      else params.delete('material');
    }
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
    router.push(`/suppliers${qs ? `?${qs}` : ''}`);
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
      <style>{LIST_CSS}</style>
      <div style={{ width: '100%', maxWidth: '1040px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <BackLink />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            SUPPLIER DIRECTORY
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Find Suppliers</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {data ? `${data.total_count} supplier${data.total_count === 1 ? '' : 's'} on record` : 'Loading…'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by supplier name…"
            aria-label="Search suppliers by name"
            style={{ flex: '1 1 260px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', background: '#fff' }}
          />
          <select
            value={city}
            onChange={(e) => updateParams({ city: e.target.value, page: 1 })}
            aria-label="City"
            style={{ padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', background: '#fff' }}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="supplier-chips" role="group" aria-label="Filter by material">
          <button type="button" className="supplier-chip" aria-pressed={material === ''} onClick={() => updateParams({ material: '', page: 1 })}>
            All
          </button>
          {MATERIAL_CATEGORY_OPTIONS.map((m) => (
            <button key={m.value} type="button" className="supplier-chip" aria-pressed={material === m.value} onClick={() => updateParams({ material: m.value, page: 1 })}>
              {m.label}
            </button>
          ))}
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
          <Spinner label="Loading suppliers…" />
        ) : data && data.suppliers.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {material || city || q ? 'No suppliers match these filters.' : 'No suppliers on record yet.'}
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
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
                opacity: loading ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {data.suppliers.map((s) => (
                <SupplierCard key={s.id} supplier={s} />
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

export default function SuppliersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SuppliersView />
    </Suspense>
  );
}
