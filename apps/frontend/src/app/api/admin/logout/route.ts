import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/adminSession';

// Clears the session cookie by re-setting it with the same attributes used
// at login (route.ts in ../login) but an immediately-expired Max-Age — the
// standard way to delete a cookie, since there's no server-side session
// store to invalidate against (see adminSession.ts).
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
