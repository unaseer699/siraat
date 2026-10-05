import Link from 'next/link';
import { Home } from 'lucide-react';
import { ACCENT_BLUE } from '@/styles/tokens';

// Persistent nav-home affordance — sits fixed top-left on every page (including
// admin) so there's always a way back to "/" without relying on browser back.
//
// REDESIGN — brought in line with the homepage's bolder, more colorful pass
// (dc344e8 and after): a filled brand-blue pill with a real Lucide icon
// instead of a muted gray outline + emoji, and the same hover-lift
// convention as .qa-card/.quick-link-pill (see globals.css's .home-button
// rule) rather than sitting visually flat against every page it floats on.
export function HomeButton() {
  return (
    <Link
      href="/"
      className="home-button"
      style={{
        position: 'fixed',
        top: '16px',
        left: '16px',
        zIndex: 40,
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
