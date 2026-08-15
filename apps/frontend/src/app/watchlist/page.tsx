'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ObservationSummary } from '@siraat/shared-types';
import { fetchSocietyChanges } from '@/lib/api';
import { getWatchlist, removeFromWatchlist, type WatchlistEntry } from '@/lib/watchlist';
import { BackLink } from '@/components/BackLink';
import { TRUST_GREEN, NEUTRAL_GRAY, RADIUS } from '@/styles/tokens';

interface WatchRow {
  entry: WatchlistEntry;
  has_changes: boolean | null; // null while loading, or if the lookup failed
  observations: ObservationSummary[];
  error: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ObservationRow({ obs }: { obs: ObservationSummary }) {
  return (
    <li
      style={{
        padding: '10px 14px',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: RADIUS.sm,
        fontSize: '13px',
      }}
    >
      <div style={{ fontWeight: 700, color: '#374151', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {obs.metric.replace(/_/g, ' ')}
      </div>
      <div style={{ color: '#111827', marginTop: '2px' }}>
        {obs.old_value !== null ? `${obs.old_value} → ${obs.new_value}` : obs.new_value}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
        {formatDate(obs.recorded_at)}
      </div>
    </li>
  );
}

function WatchCard({ row, onRemove }: { row: WatchRow; onRemove: (id: string) => void }) {
  const { entry } = row;
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <Link href={`/society/${entry.society_id}`} style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            {entry.society_name}
          </Link>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
            Watching since {formatDate(entry.date_added)}
          </p>
        </div>
        <button
          onClick={() => onRemove(entry.society_id)}
          style={{
            fontSize: '12px',
            color: 'var(--muted)',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 10px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Remove
        </button>
      </div>

      {row.error && (
        <p style={{ fontSize: '13px', color: 'var(--error)' }}>
          Could not check for changes: {row.error}
        </p>
      )}

      {row.has_changes === null && !row.error && (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Checking for changes…</p>
      )}

      {row.has_changes === false && (
        <p style={{ fontSize: '13px', color: TRUST_GREEN, fontWeight: 600 }}>✓ No changes since you started watching</p>
      )}

      {row.has_changes === true && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {row.observations.map((obs, i) => (
            <ObservationRow key={i} obs={obs} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WatchlistPage() {
  const [rows, setRows] = useState<WatchRow[] | null>(null);

  useEffect(() => {
    const entries = getWatchlist();
    if (entries.length === 0) {
      setRows([]);
      return;
    }

    setRows(entries.map((entry) => ({ entry, has_changes: null, observations: [], error: null })));

    let cancelled = false;
    Promise.all(
      entries.map(async (entry): Promise<WatchRow> => {
        try {
          // Each society is checked against its own "date added" — a request
          // per entry rather than one batched call, since watched societies
          // can have different since-dates.
          const result = await fetchSocietyChanges({
            society_ids: [entry.society_id],
            since: entry.date_added,
          });
          const change = result.changes[0];
          return {
            entry,
            has_changes: change?.has_changes ?? false,
            observations: change?.observations ?? [],
            error: null,
          };
        } catch (e) {
          return {
            entry,
            has_changes: null,
            observations: [],
            error: e instanceof Error ? e.message : 'Unknown error',
          };
        }
      }),
    ).then((results) => {
      if (!cancelled) setRows(results);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleRemove(societyId: string) {
    removeFromWatchlist(societyId);
    setRows((prev) => (prev ? prev.filter((r) => r.entry.society_id !== societyId) : prev));
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
      <div style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <BackLink fallbackHref="/" />

        <div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
            YOUR WATCHLIST
          </p>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Watched Societies</h1>
          <p style={{ fontSize: '13px', color: NEUTRAL_GRAY, marginTop: '8px', lineHeight: 1.5 }}>
            Your watchlist is stored in this browser only and won&apos;t be available on other
            devices. Closing this browser or clearing site data will clear it.
          </p>
        </div>

        {rows === null && <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading your watchlist…</p>}

        {rows !== null && rows.length === 0 && (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: RADIUS.md,
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '14px', color: 'var(--text)' }}>
              You aren&apos;t watching any societies yet.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '8px' }}>
              Open a society&apos;s profile and select &ldquo;☆ Watch this society&rdquo; to track
              it here.
            </p>
          </div>
        )}

        {rows !== null &&
          rows.length > 0 &&
          rows.map((row) => (
            <WatchCard key={row.entry.society_id} row={row} onRemove={handleRemove} />
          ))}
      </div>
    </main>
  );
}
