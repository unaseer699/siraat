import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession';

// Gate-level protection for the whole /admin/* tree — one place, rather than
// relying on every admin page to remember to check its own session, which is
// how the previous "ADMIN — INTERNAL ONLY" label ended up being just a label.
// The matcher below scopes this to /admin/* only, so it never touches public
// pages.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The login page itself must stay reachable without a session, or nobody
  // could ever get one.
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_PANEL_PASSWORD;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = secret ? await verifySessionToken(token, secret) : false;

  if (!valid) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
