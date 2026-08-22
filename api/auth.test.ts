import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveIdentity } from './_lib/auth';
import { signGuestId, verifyGuestId } from './_lib/guest';

vi.mock('./_lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from './_lib/supabaseAdmin';

describe('Authentication & Guest Identity Boundary', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('resolveIdentity', () => {
    it('resolves guest identity when authorization header is absent', async () => {
      const identity = await resolveIdentity(null, null);
      expect(identity.type).toBe('guest');
      expect(identity.userId).toBeNull();
      expect(identity.identifier).toMatch(/^guest:[a-f0-9-]+$/);
      expect(identity.guestCookieHeader).toBeDefined();
    });

    it('rejects malformed authorization header with unauthorized (never falls back to guest)', async () => {
      const identity = await resolveIdentity('Basic abc123xyz', null);
      expect(identity.type).toBe('unauthorized');
      expect(identity.userId).toBeNull();
      expect(identity.error).toContain('Malformed Authorization header');
    });

    it('rejects empty bearer token with unauthorized', async () => {
      const identity = await resolveIdentity('Bearer    ', null);
      expect(identity.type).toBe('unauthorized');
      expect(identity.userId).toBeNull();
      expect(identity.error).toContain('Empty bearer token');
    });

    it('returns unauthorized when Supabase returns token error (never falls back to guest)', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'JWT expired' },
          }),
        },
      };
      vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

      const identity = await resolveIdentity('Bearer expired-or-invalid-token', null);
      expect(identity.type).toBe('unauthorized');
      expect(identity.userId).toBeNull();
      expect(identity.error).toContain('JWT expired');
    });

    it('resolves authenticated user identity when valid bearer token is provided', async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-123-uuid' } },
            error: null,
          }),
        },
      };
      vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

      const identity = await resolveIdentity('Bearer valid-jwt-token', null);
      expect(identity.type).toBe('user');
      expect(identity.userId).toBe('usr-123-uuid');
      expect(identity.identifier).toBe('user:usr-123-uuid');
    });
  });

  describe('Guest Cookie Signing & Production Secret Enforcement', () => {
    it('signs and verifies guest ID HMAC signatures', () => {
      const testId = '4c4314c4-7221-420d-8524-ec5d09f7a77d';
      const signed = signGuestId(testId);
      expect(signed).toContain(testId);

      const verified = verifyGuestId(signed);
      expect(verified).toBe(testId);
    });

    it('rejects tampered guest cookie signatures', () => {
      const testId = '4c4314c4-7221-420d-8524-ec5d09f7a77d';
      const signed = signGuestId(testId);
      const tampered = signed.replace('4c4314c4', 'ffffffff');

      const verified = verifyGuestId(tampered);
      expect(verified).toBeNull();
    });

    it('throws in production if GUEST_COOKIE_SECRET is missing or too short', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.GUEST_COOKIE_SECRET;

      expect(() => signGuestId('test-uuid')).toThrowError(/GUEST_COOKIE_SECRET/);

      process.env.GUEST_COOKIE_SECRET = 'too-short-secret';
      expect(() => signGuestId('test-uuid')).toThrowError(/at least 32 characters/);
    });
  });
});
