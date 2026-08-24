import Link from 'next/link';

// Persistent nav-home affordance — sits fixed top-left on every page (including
// admin) so there's always a way back to "/" without relying on browser back.
// Mirrors the Watchlist link's styling (page.tsx) and the Clear/Add button
// convention (border/radius/background trio used across the admin forms),
// since no other fixed-chrome pattern existed yet to reuse.
export function HomeButton() {
  return (
    <Link
      href="/"
      style={{
        position: 'fixed',
        top: '16px',
        left: '16px',
        zIndex: 40,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--muted)',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '6px 10px',
      }}
    >
      🏠 Home
    </Link>
  );
}
