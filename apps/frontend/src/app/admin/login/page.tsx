'use client';

import { useState, type FormEvent } from 'react';
import { errorTextStyle, fieldGroupStyle, inputStyle, labelStyle } from '../constants';

// Only allow redirecting back to an internal, absolute path — `from` is a
// query param a visitor could hand-edit, so reject anything that isn't a
// single leading slash (rules out `//evil.com` and `https://evil.com`).
function safeFrom(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/admin/candidates';
  return raw;
}

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Incorrect password');
        setSubmitting(false);
        return;
      }
      // Full navigation (not router.push) so the next request carries the
      // just-set cookie through middleware fresh, rather than relying on the
      // App Router's client-side cache picking it up.
      const params = new URLSearchParams(window.location.search);
      window.location.href = safeFrom(params.get('from'));
    } catch {
      setError('Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: '360px', margin: '96px auto', padding: '0 16px' }}>
      <p style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>
        ADMIN — INTERNAL ONLY
      </p>
      <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '20px' }}>Admin Login</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={fieldGroupStyle}>
          <label style={labelStyle} htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoFocus
            autoComplete="current-password"
          />
        </div>
        {error && <p style={errorTextStyle}>{error}</p>}
        <button
          type="submit"
          disabled={submitting || password.length === 0}
          style={{
            padding: '10px 14px',
            fontSize: '14px',
            fontWeight: 700,
            borderRadius: 'var(--radius)',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            cursor: submitting || password.length === 0 ? 'default' : 'pointer',
            opacity: submitting || password.length === 0 ? 0.6 : 1,
          }}
        >
          {submitting ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
