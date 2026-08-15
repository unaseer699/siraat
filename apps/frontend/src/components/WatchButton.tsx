'use client';

import { useEffect, useState } from 'react';
import { addToWatchlist, isWatching, removeFromWatchlist } from '@/lib/watchlist';

interface Props {
  societyId: string;
  societyName: string;
}

// Toggle button for the browser-local watchlist (see lib/watchlist.ts — this is
// intentionally session-only, not synced anywhere). Starts unwatched on the
// server-rendered pass and reconciles against sessionStorage on mount, since
// that storage doesn't exist during SSR.
export function WatchButton({ societyId, societyName }: Props) {
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    setWatching(isWatching(societyId));
  }, [societyId]);

  function handleClick() {
    if (watching) {
      removeFromWatchlist(societyId);
      setWatching(false);
    } else {
      addToWatchlist(societyId, societyName);
      setWatching(true);
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        fontSize: '13px',
        fontWeight: 600,
        color: watching ? '#fff' : 'var(--text)',
        background: watching ? 'var(--brand)' : 'none',
        border: `1px solid ${watching ? 'var(--brand)' : 'var(--border)'}`,
        borderRadius: '4px',
        padding: '6px 12px',
        cursor: 'pointer',
      }}
    >
      {watching ? '★ Watching' : '☆ Watch this society'}
    </button>
  );
}
