import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BearerGuard } from './bearer.guard';

function makeContext(authHeader: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: authHeader },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('BearerGuard', () => {
  let guard: BearerGuard;
  const REAL_KEY = 'test-api-key-12345';

  beforeEach(async () => {
    process.env.SIRAAT_API_KEY = REAL_KEY;
    const module = await Test.createTestingModule({ providers: [BearerGuard] }).compile();
    guard = module.get(BearerGuard);
  });

  afterEach(() => {
    delete process.env.SIRAAT_API_KEY;
  });

  it('allows request with valid Bearer token', () => {
    expect(() => guard.canActivate(makeContext(`Bearer ${REAL_KEY}`))).not.toThrow();
    expect(guard.canActivate(makeContext(`Bearer ${REAL_KEY}`))).toBe(true);
  });

  it('throws ForbiddenException for missing Authorization header', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for wrong API key', () => {
    expect(() => guard.canActivate(makeContext('Bearer wrong-key'))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for "Bearer anonymous" (old placeholder)', () => {
    expect(() => guard.canActivate(makeContext('Bearer anonymous'))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when Authorization header is missing Bearer prefix', () => {
    expect(() => guard.canActivate(makeContext(REAL_KEY))).toThrow(ForbiddenException);
  });

  it('ForbiddenException response has error_code OBO_PERMISSION_DENIED', () => {
    try {
      guard.canActivate(makeContext(undefined));
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response.error_code).toBe('OBO_PERMISSION_DENIED');
      expect(typeof response.message).toBe('string');
    }
  });

  it('throws ForbiddenException when SIRAAT_API_KEY env var is not set', () => {
    delete process.env.SIRAAT_API_KEY;
    expect(() => guard.canActivate(makeContext(`Bearer ${REAL_KEY}`))).toThrow(ForbiddenException);
  });
});
