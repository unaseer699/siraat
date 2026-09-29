import Link from 'next/link';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import { RADIUS } from '@/styles/tokens';

// Icon-first: icon + 1-2 word title, plus a short (4-6 word) muted subtitle —
// same heading + supporting-line pattern used elsewhere (e.g. society/[id]
// and contractor/[id] profile headers: bold heading, then a smaller
// var(--muted) line directly below), not a return to full paragraph copy.
// `qa-card` is the hover convention defined once in globals.css (border-color
// shift, no transform — nothing else in the app uses a hover transform to reuse).
//
// Extracted from app/page.tsx (HOMEPAGE REDESIGN) so /tools/page.tsx can
// reuse the exact same card instead of duplicating markup.
export function QuickAccessCard({
  href,
  icon: Icon,
  title,
  subtitle,
  ariaLabel,
  id,
}: {
  href?: string;
  icon: ComponentType<LucideProps>;
  title: string;
  subtitle: string;
  ariaLabel: string;
  id?: string;
}) {
  const content = (
    <div
      className={href ? 'qa-card' : undefined}
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
        padding: '24px 20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        textAlign: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <Icon size={26} color="var(--brand)" aria-hidden="true" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>{subtitle}</p>
      </div>
    </div>
  );

  if (!href) {
    return (
      <div id={id} style={{ flex: '1 1 220px', minWidth: '220px', scrollMarginTop: '24px' }} aria-label={ariaLabel}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      id={id}
      aria-label={ariaLabel}
      style={{ flex: '1 1 220px', minWidth: '220px', display: 'block', scrollMarginTop: '24px' }}
    >
      {content}
    </Link>
  );
}
