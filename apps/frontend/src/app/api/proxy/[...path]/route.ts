import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession';

// Same-origin proxy that holds the real backend credentials server-side and
// forwards every browser call to the Siraat backend — see resolveTarget in
// apps/frontend/src/lib/api.ts, which routes all client-side calls here
// instead of hitting the backend directly with a key baked into the bundle.
// Path shape mirrors the backend's own namespace one-for-one:
// /api/proxy/admin/candidate-societies -> ${BACKEND_URL}/v1/admin/candidate-societies
// /api/proxy/market-intelligence/...   -> ${BACKEND_URL}/v1/market-intelligence/...
//
// /admin/* segments additionally require a valid admin session cookie here,
// not just at the page level: middleware.ts's matcher is `/admin/:path*`,
// which does not cover `/api/*` — a request sent straight to this route
// (skipping the page and its redirect) would otherwise reach the backend
// with the real key, unauthenticated. This check is defense in depth, not a
// replacement for the login gate.
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function hasValidAdminSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.ADMIN_PANEL_PASSWORD;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  return secret ? await verifySessionToken(token, secret) : false;
}

async function forward(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (segments[0] === 'admin' && !(await hasValidAdminSession(req))) {
    return NextResponse.json(
      { error_code: 'UNAUTHORIZED', message: 'Admin session required' },
      { status: 401 },
    );
  }

  const apiKey = process.env.SIRAAT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error_code: 'SERVER_MISCONFIGURED', message: 'SIRAAT_API_KEY is not set' },
      { status: 503 },
    );
  }

  const target = `${BACKEND_URL}/v1/${segments.join('/')}${req.nextUrl.search}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  const backendRes = await fetch(target, {
    method: req.method,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Siraat-Country-Code': 'PK',
    },
    body: hasBody ? await req.text() : undefined,
  });

  // A 204 must carry no body — mirrors ADMIN CRUD PHASE 1 Chunk 2's res.json()
  // skip in apiFetch, one layer further out.
  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const bodyBuf = await backendRes.arrayBuffer();
  const headers = new Headers();
  const contentType = backendRes.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // fetchRecommendationExport relies on this to name the downloaded file.
  const disposition = backendRes.headers.get('content-disposition');
  if (disposition) headers.set('content-disposition', disposition);

  return new NextResponse(bodyBuf, { status: backendRes.status, headers });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, params.path);
}
