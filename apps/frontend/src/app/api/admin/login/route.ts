import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  passwordsMatch,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '@/lib/adminSession';

// ADMIN_PANEL_PASSWORD is deliberately a separate env var from SIRAAT_API_KEY
// (the shared backend Bearer token, see apps/frontend/src/lib/api.ts). They
// guard different things — this one gates browser access to /admin, that one
// authenticates every API call — and reusing one value for both would mean
// rotating either secret forces rotating both, and would mean typing the
// backend's API key into a login form (visible to anyone at the keyboard,
// logged by password managers, etc). A dedicated password costs one more env
// var and keeps the two boundaries independent.
export async function POST(req: NextRequest) {
  const expectedPassword = process.env.ADMIN_PANEL_PASSWORD;
  if (!expectedPassword) {
    return NextResponse.json(
      { error: 'Admin panel is not configured (ADMIN_PANEL_PASSWORD unset)' },
      { status: 503 },
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || !(await passwordsMatch(password, expectedPassword))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = await createSessionToken(expectedPassword);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
