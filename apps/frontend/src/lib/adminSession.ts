// Minimal admin session gate — a single shared password, not a user/identity
// system (see apps/backend/src/auth/bearer.guard.ts's own comment on why that's
// out of scope). Used by both the login route (Node.js runtime) and the
// middleware (Edge runtime), so this only uses Web Crypto (`crypto.subtle`),
// never Node's `crypto` module — that's the one API guaranteed to exist in both.

export const SESSION_COOKIE_NAME = 'siraat_admin_session';

// 24 hours: long enough that a solo founder logging in once a day isn't
// re-prompted mid-session, short enough that a leaked/stale cookie (shared
// browser, old laptop) doesn't stay valid indefinitely. There's no user base
// to segment by risk tolerance here, so one flat duration is enough.
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bufToHex(sig);
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return bufToHex(digest);
}

// Constant-time comparison over equal-length strings (both sides here are
// always hex digests of a fixed length) so a mismatch can't be timed out
// character-by-character.
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Hashes both sides to a fixed-length digest before comparing, so this never
// short-circuits on the entered password's raw length either.
export async function passwordsMatch(input: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  return timingSafeEqualStr(a, b);
}

// Token shape: `${expiryUnixSeconds}.${hmacHex(expiryUnixSeconds)}` — no
// session store needed, the secret (ADMIN_PANEL_PASSWORD) is the only thing
// that has to stay server-side.
export async function createSessionToken(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sig = await hmacHex(String(exp), secret);
  return `${exp}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(expStr, secret);
  return timingSafeEqualStr(sig, expected);
}
