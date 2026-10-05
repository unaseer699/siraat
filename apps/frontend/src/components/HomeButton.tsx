import Link from 'next/link';
import { Home } from 'lucide-react';
import { ACCENT_BLUE } from '@/styles/tokens';

// Persistent nav-home affordance, present on every page (including admin)
// so there's always a way back to "/" without relying on browser back.
//
// MOBILE REVIEW finding — this used to be `position: fixed` floating over
// page content. Every page/detail/admin screen starts its own top-left
// content (a BackLink or the AdminNav tab row) within the first ~48-56px of
// vertical space and ~16px of horizontal space, which is exactly where the
// fixed pill sat — so on a phone-width viewport it visually covered real,
// clickable UI on nearly every page. Rather than hand-tune top padding
// across ~20 files (one per page), this is now a real sticky bar rendered
// once in layout.tsx (see AppHeader below): it occupies actual document
// flow space, so every page's content naturally starts below it with zero
// per-page changes, and it can never overlap anything.
//
// REDESIGN — also carries the bolder, more colorful pass (dc344e8 and
// after): a filled brand-blue pill with a real Lucide icon instead of the
// original muted gray outline + emoji.
export function HomeButton() {
  return (
    <Link
      href="/"
      className="home-button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '13px',
        fontWeight: 700,
        color: '#fff',
        background: ACCENT_BLUE,
        border: 'none',
        borderRadius: '99px',
        padding: '8px 14px',
        boxShadow: '0 2px 6px rgba(26,86,219,0.35)',
        textDecoration: 'none',
      }}
    >
      <Home size={15} aria-hidden="true" />
      Home
    </Link>
  );
}

// The sticky bar itself — full-width, blurred-white background so it reads
// as a lightweight app chrome bar rather than another content section.
// `position: sticky` (not `fixed`) means it still scrolls away/back exactly
// like a native app's nav bar, but reserves its own height in the page's
// normal flow instead of overlaying whatever happens to be underneath it.
export function AppHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'rgba(249,250,251,0.92)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <HomeButton />
    </header>
  );
}
