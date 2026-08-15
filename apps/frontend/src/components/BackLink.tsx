'use client';

import { useRouter } from 'next/navigation';

interface Props {
  label?: string;
  fallbackHref?: string;
}

// Prefers real browser history (router.back()) so the user returns to their
// exact prior state — e.g. a search with its query params and results intact —
// rather than being reset to a generic destination. Falls back to `fallbackHref`
// when there's no in-app history to go back to (page opened directly, shared link).
export function BackLink({ label = '← Back to search', fallbackHref = '/' }: Props) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        fontSize: '14px',
        color: 'var(--muted)',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}
