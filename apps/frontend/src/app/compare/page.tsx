'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { SocietyScoreResponse, VerificationResponse } from '@siraat/shared-types';
import { fetchSocietyScore, fetchSocietyVerifications } from '@/lib/api';
import { ConfidenceGauge } from '@/components/ConfidenceGauge';
import { SCORE_BREAKDOWN_ROWS, toneColor, toneIcon } from '@/components/ScoreBreakdown';
import { DANGER_RED, NEUTRAL_GRAY, RADIUS } from '@/styles/tokens';

function formatPKR(n: number): string {
  if (n >= 1e7) return `PKR ${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `PKR ${(n / 1e5).toFixed(1)} Lakh`;
  return `PKR ${n.toLocaleString()}`;
}

function formatRange(range: { min: number | null; max: number | null }, fmt: (n: number) => string): string {
  if (range.min === null && range.max === null) return '—';
  if (range.min !== null && range.max !== null && range.min !== range.max) {
    return `${fmt(range.min)} – ${fmt(range.max)}`;
  }
  return fmt(range.min ?? range.max ?? 0);
}

interface SocietyColumn {
  society_id: string;
  score: SocietyScoreResponse | null;
  claims: VerificationResponse[] | null;
  error: string | null;
}

const rowLabelCellStyle = {
  padding: '12px 16px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#374151',
  whiteSpace: 'nowrap' as const,
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'middle' as const,
};

const cellStyle = {
  padding: '12px 16px',
  fontSize: '13px',
  color: '#111827',
  borderBottom: '1px solid #e5e7eb',
  borderLeft: '1px solid #f3f4f6',
  verticalAlign: 'middle' as const,
};

function ErrorCell({ error }: { error: string }) {
  return (
    <span style={{ color: DANGER_RED, fontSize: '12px' }} title={error}>
      Unavailable
    </span>
  );
}

function CompareView() {
  const params = useSearchParams();
  const idsParam = params.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const [columns, setColumns] = useState<SocietyColumn[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (ids.length === 0) {
      setColumns([]);
      return;
    }

    Promise.all(
      ids.map(async (id): Promise<SocietyColumn> => {
        try {
          const [score, verifications] = await Promise.all([
            fetchSocietyScore(id),
            fetchSocietyVerifications(id).catch(() => null),
          ]);
          return {
            society_id: id,
            score,
            claims: verifications?.claims ?? null,
            error: null,
          };
        } catch (e) {
          return {
            society_id: id,
            score: null,
            claims: null,
            error: e instanceof Error ? e.message : 'Failed to load this society.',
          };
        }
      }),
    ).then((results) => {
      if (!cancelled) setColumns(results);
    });

    return () => {
      cancelled = true;
    };
    // idsParam captures the same info as `ids` in a stable, comparable form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  if (columns === null) {
    return (
      <main style={pageStyle}>
        <p style={{ color: 'var(--muted)' }}>Loading comparison…</p>
      </main>
    );
  }

  if (columns.length < 2) {
    return (
      <main style={pageStyle}>
        <Link href="/" style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to search
        </Link>
        <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text)' }}>
          Select 2 or 3 societies to compare from the search results using the &ldquo;Add to
          compare&rdquo; checkbox on each result.
        </p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ width: '100%', maxWidth: '960px' }}>
        <Link href="/" style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ← Back to search
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '12px' }}>
          Compare Societies
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
          {columns.length} societies selected
        </p>

        <div style={{ overflowX: 'auto', marginTop: '20px', borderRadius: RADIUS.md }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${180 + columns.length * 220}px` }}>
            <thead>
              <tr>
                <th style={{ ...rowLabelCellStyle, background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }} />
                {columns.map((col) => {
                  const isAdverse = (col.claims ?? []).some((c) => c.status === 'DISPUTED');
                  return (
                    <th
                      key={col.society_id}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        background: isAdverse ? '#fef2f2' : '#f9fafb',
                        borderBottom: `2px solid ${isAdverse ? DANGER_RED : '#e5e7eb'}`,
                        borderLeft: '1px solid #f3f4f6',
                        minWidth: '200px',
                      }}
                    >
                      <Link
                        href={`/society/${col.society_id}`}
                        style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}
                      >
                        {col.score?.society_name ?? col.society_id}
                      </Link>
                      {isAdverse && (
                        <div style={{ fontSize: '11px', fontWeight: 700, color: DANGER_RED, marginTop: '4px' }}>
                          ⚠ Adverse claim on record
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={rowLabelCellStyle}>Confidence</td>
                {columns.map((col) => (
                  <td key={col.society_id} style={cellStyle}>
                    {col.score ? (
                      <ConfidenceGauge score={col.score.confidence_score} size="sm" />
                    ) : col.error ? (
                      <ErrorCell error={col.error} />
                    ) : (
                      '—'
                    )}
                  </td>
                ))}
              </tr>

              {SCORE_BREAKDOWN_ROWS.map((row) => (
                <tr key={row.key}>
                  <td style={rowLabelCellStyle}>{row.category}</td>
                  {columns.map((col) => {
                    if (!col.score?.breakdown) {
                      return (
                        <td key={col.society_id} style={cellStyle}>
                          {col.error ? <ErrorCell error={col.error} /> : '—'}
                        </td>
                      );
                    }
                    const tone = row.tone(col.score.breakdown);
                    return (
                      <td key={col.society_id} style={cellStyle}>
                        <span style={{ color: toneColor(tone), fontWeight: 700, marginRight: '6px' }}>
                          {toneIcon(tone)}
                        </span>
                        {row.label(col.score.breakdown)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr>
                <td style={rowLabelCellStyle}>Price Range</td>
                {columns.map((col) => (
                  <td key={col.society_id} style={cellStyle}>
                    {col.score ? formatRange(col.score.price_range, formatPKR) : col.error ? <ErrorCell error={col.error} /> : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={rowLabelCellStyle}>Area Range</td>
                {columns.map((col) => (
                  <td key={col.society_id} style={{ ...cellStyle, color: col.score ? cellStyle.color : NEUTRAL_GRAY }}>
                    {col.score
                      ? formatRange(col.score.area_range, (n) => `${n} Marla`)
                      : col.error
                        ? <ErrorCell error={col.error} />
                        : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  padding: '48px 16px 32px',
};

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareView />
    </Suspense>
  );
}
