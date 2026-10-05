'use client';

import Link from 'next/link';

// UI REVIEW finding — no route anywhere had an error.tsx, so an unhandled
// render/data error surfaced Next's generic dev/prod error screen rather
// than something in Siraat's own voice with a way back. 'use client' is
// required by Next for error boundaries.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Something went wrong</h2>
      <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '360px' }}>
        This page hit an unexpected error. You can try again, or go back home.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '10px 18px',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: '10px 18px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            color: 'inherit',
          }}
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
