import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveIdentity } from '../../api/_lib/auth.js';
import { signGuestId, verifyGuestId } from '../../api/_lib/guest.js';

vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from '../../api/_lib/supabaseAdmin.js';

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
      expect(identity.error).toBe('Invalid or expired bearer token');
    });

    it('returns unavailable when the authentication client is not configured', async () => {
      vi.mocked(getSupabaseAdmin).mockReturnValue(null);

      const identity = await resolveIdentity('Bearer valid-looking-token', null);
      expect(identity.type).toBe('unavailable');
      expect(identity.error).toBe('Authentication service is temporarily unavailable');
    });

    it('returns unavailable without exposing provider errors when verification throws', async () => {
      vi.mocked(getSupabaseAdmin).mockReturnValue({
        auth: { getUser: vi.fn().mockRejectedValue(new Error('private provider detail')) },
      } as any);

      const identity = await resolveIdentity('Bearer valid-looking-token', null);
      expect(identity.type).toBe('unavailable');
      expect(identity.error).not.toContain('private provider detail');
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

    it('derives a stable, opaque network fingerprint only when an IP is available', async () => {
      process.env.GUEST_COOKIE_SECRET = 'a-secure-test-secret-that-is-long-enough';
      const first = await resolveIdentity(null, null, '203.0.113.42', 'test-agent');
      const sameSubnet = await resolveIdentity(null, null, '203.0.113.99', 'test-agent');
      const noIp = await resolveIdentity(null, null, null, 'test-agent');

      expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(sameSubnet.fingerprint).toBe(first.fingerprint);
      expect(noIp.fingerprint).toBeUndefined();
      expect(first.fingerprint).not.toContain('203.0.113');
    });
  });
});
