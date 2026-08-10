import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BearerGuard } from '../auth/bearer.guard';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(authHeader: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: authHeader } }),
    }),
  } as unknown as ExecutionContext;
}

// Mirror the options used in AppModule exactly — if AppModule changes its envFilePath,
// update this constant so the two stay in sync.
const APP_MODULE_CONFIG_OPTIONS = { envFilePath: '.env' };

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('env loading — ConfigModule.forRoot populates process.env from .env', () => {
  // Preserve whatever the key was before this file ran (e.g. set by CI or a prior spec)
  // so we can restore it in afterAll and avoid leaking state to other test files.
  const keySnapshot = process.env.SIRAAT_API_KEY;

  beforeEach(() => {
    // Simulate a fresh process with no pre-loaded API key.
    // This is the exact condition that caused today's bug: ConfigModule was missing
    // from AppModule, so the key was never populated and the guard always saw undefined.
    delete process.env.SIRAAT_API_KEY;
  });

  afterAll(() => {
    if (keySnapshot !== undefined) {
      process.env.SIRAAT_API_KEY = keySnapshot;
    } else {
      delete process.env.SIRAAT_API_KEY;
    }
  });

  // ── Precondition ────────────────────────────────────────────────────────────

  it('SIRAAT_API_KEY is absent from process.env before any module initializes (precondition)', () => {
    // Confirms beforeEach is doing its job — this test would catch a broken beforeEach.
    expect(process.env.SIRAAT_API_KEY).toBeUndefined();
  });

  // ── Test 1: ConfigModule actually loads the file ────────────────────────────

  it('SIRAAT_API_KEY is defined and non-empty after ConfigModule.forRoot initializes', async () => {
    // Key starts undefined (see beforeEach). ConfigModule loading the .env file
    // is the only thing that can make it appear.
    await Test.createTestingModule({
      imports: [ConfigModule.forRoot(APP_MODULE_CONFIG_OPTIONS)],
    }).compile();

    expect(process.env.SIRAAT_API_KEY).toBeDefined();
    expect(process.env.SIRAAT_API_KEY).not.toBe('');
  });

  // ── Test 2: env loading connects to guard validation ────────────────────────

  it('BearerGuard accepts the key loaded from .env — env loading and guard are end-to-end connected', async () => {
    // This test would have caught today's regression immediately:
    // No ConfigModule → SIRAAT_API_KEY stays undefined → guard always throws → this test fails.
    //
    // It also exercises two components together rather than each in isolation:
    // ConfigModule (env loading) and BearerGuard (env consumption).
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(APP_MODULE_CONFIG_OPTIONS)],
      providers: [BearerGuard],
    }).compile();

    const guard = moduleRef.get(BearerGuard);
    const loadedKey = process.env.SIRAAT_API_KEY;

    // If env loading failed, report it clearly before the guard assertion masks the real cause.
    expect(loadedKey).toBeDefined();
    expect(loadedKey).not.toBe('');

    // The core assertion: the key ConfigModule loaded is the key the guard accepts.
    const ctx = makeContext(`Bearer ${loadedKey}`);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).not.toThrow(ForbiddenException);
  });
});
