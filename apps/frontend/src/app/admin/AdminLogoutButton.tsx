'use client';

import { useState } from 'react';

// The only interactive piece of the otherwise server-rendered AdminNav —
// split out so AdminNav itself doesn't need to become a client component.
export function AdminLogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      // Full navigation, not router.push — guarantees the next request to
      // /admin/login (and middleware's read of the now-cleared cookie on any
      // subsequent /admin/* visit) sees fresh state rather than a cached one.
      window.location.href = '/admin/login';
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      style={{
        padding: '10px 14px',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--muted)',
        background: 'none',
        border: 'none',
        borderBottom: '2px solid transparent',
        marginBottom: '-1px',
        marginLeft: 'auto',
        cursor: loggingOut ? 'default' : 'pointer',
      }}
    >
      {loggingOut ? 'Logging out…' : 'Log out'}
    </button>
  );
}
