// Watchlist Chunk 2 — client-side watchlist storage.
//
// IMPORTANT — this is intentionally session-local, not a bug:
// A watchlist is a personal, throwaway convenience (there is no User/Identity
// system for it to belong to yet). Unlike the Comparison feature — which stores
// its selection in the URL because a comparison must be SHAREABLE across
// devices/browsers/people — a watchlist has no shareability or durability
// requirement. sessionStorage (cleared when the tab/browser session ends) is
// the correct, deliberate scope for it, not a repeat of the mistake that was
// fixed for Comparison. See the Watchlist page copy for the same honesty
// disclosed to the user.

const STORAGE_KEY = 'siraat.watchlist.v1';

export interface WatchlistEntry {
  society_id: string;
  society_name: string;
  // ISO date string — also doubles as the `since` cursor for the
  // /societies/changes lookup ("what changed since I started watching this").
  date_added: string;
}

function readAll(): WatchlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchlistEntry[]) : [];
  } catch {
    // Corrupt or unavailable storage — treat as an empty watchlist rather
    // than throwing and breaking the page that called this.
    return [];
  }
}

function writeAll(entries: WatchlistEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage can be unavailable (private browsing, quota) — silently no-op,
    // same failure mode as the rest of this session-local, best-effort feature.
  }
}

export function getWatchlist(): WatchlistEntry[] {
  return readAll();
}

export function isWatching(societyId: string): boolean {
  return readAll().some((e) => e.society_id === societyId);
}

export function addToWatchlist(societyId: string, societyName: string): WatchlistEntry[] {
  const entries = readAll();
  if (entries.some((e) => e.society_id === societyId)) return entries;
  const next = [...entries, { society_id: societyId, society_name: societyName, date_added: new Date().toISOString() }];
  writeAll(next);
  return next;
}

export function removeFromWatchlist(societyId: string): WatchlistEntry[] {
  const next = readAll().filter((e) => e.society_id !== societyId);
  writeAll(next);
  return next;
}
