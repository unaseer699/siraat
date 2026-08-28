'use client';

import { Suspense, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ContractorListResponse, SocietyVerificationStatus } from '@siraat/shared-types';
import { fetchContractors, fetchPlatformStats } from '@/lib/api';
import { TRADE_CATEGORY_OPTIONS } from '@/lib/tradeCategories';
import { BackLink } from '@/components/BackLink';
import { TRUST_GREEN, WARNING_AMBER, DANGER_RED, NEUTRAL_GRAY, RADIUS } from '@/styles/tokens';

const PAGE_SIZE = 20;

// Same badge treatment as browse/page.tsx's StatusBadge — VERIFIED/PARTIAL/
// PENDING/DISPUTED is the same claim-derived status Society Browse uses,
// just derived from a Contractor's claims instead (TrustService, reused).
const STATUS_META: Record<
  SocietyVerificationStatus,
  { color: string; bg: string; border: string; icon: string }
> = {
  VERIFIED: { color: TRUST_GREEN, bg: '#f0fdf4', border: `${TRUST_GREEN}40`, icon: '✓' },
  DISPUTED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '⚠' },
  CANCELLED: { color: DANGER_RED, bg: '#fef2f2', border: `${DANGER_RED}40`, icon: '✕' },
  PARTIAL: { color: WARNING_AMBER, bg: '#fffbeb', border: `${WARNING_AMBER}40`, icon: '…' },
  PENDING: { color: NEUTRAL_GRAY, bg: '#f9fafb', border: `${NEUTRAL_GRAY}40`, icon: '○' },
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
      {meta.icon} {status}
    </span>
  );
}

function tradeLabel(value: string): string {
  return TRADE_CATEGORY_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

function ContractorCard({ contractor }: { contractor: ContractorListResponse['contractors'][number] }) {
  return (
    <Link
      href={`/contractor/${contractor.id}`}
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
    >
      <article
        style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: RADIUS.md,
          padding: '20px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{contractor.name}</h3>
          <StatusBadge status={contractor.verification_status} />
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {contractor.trade_categories.map((t) => (
            <span
              key={t}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--muted)',
                border: '1px solid var(--border)',
                padding: '2px 8px',
                borderRadius: '99px',
              }}
            >
              {tradeLabel(t)}
            </span>
          ))}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {contractor.service_cities.join(', ')}
        </p>
      </article>
    </Link>
  );
}

function paginationButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: disabled ? '#f3f4f6' : '#fff',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function ContractorsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trade = searchParams.get('trade') ?? '';
  const city = searchParams.get('city') ?? '';
  const page = Number(searchParams.get('page') ?? '1') || 1;

  const [data, setData] = useState<ContractorListResponse | null>(null);
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
    fetchContractors({ trade_category: trade || undefined, city: city || undefined, page, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load contractors');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trade, city, page]);

  function updateParams(next: { trade?: string; city?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trade !== undefined) {
      if (next.trade) params.set('trade', next.trade);
      else params.delete('trade');
    }
    if (next.city !== undefined) {
      if (next.city) params.set('city', next.city);
      else params.delete('city');
    }
    if (next.page !== undefined) {
      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');
    }
    const qs = params.toString();
    router.push(`/contractors${qs ? `?${qs}` : ''}`);
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
            CONTRACTOR DIRECTORY
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Find Contractors</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            {data ? `${data.total_count} contractor${data.total_count === 1 ? '' : 's'} on record` : 'Loading…'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>Trade</label>
            <select
              value={trade}
              onChange={(e) => updateParams({ trade: e.target.value, page: 1 })}
              style={{
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '14px',
                background: '#fff',
              }}
            >
              <option value="">All trades</option>
              {TRADE_CATEGORY_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', fontWeight: 600 }}>City</label>
            <select
              value={city}
              onChange={(e) => updateParams({ city: e.target.value, page: 1 })}
              style={{
                padding: '8px 12px',
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

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading contractors…</p>
        ) : data && data.contractors.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            {trade || city ? 'No contractors match these filters.' : 'No contractors on record yet.'}
          </p>
        ) : data ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
              }}
            >
              {data.contractors.map((c) => (
                <ContractorCard key={c.id} contractor={c} />
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
          </>
        ) : null}
      </div>
    </main>
  );
}

export default function ContractorsPage() {
  return (
    <Suspense fallback={null}>
      <ContractorsView />
    </Suspense>
  );
}
