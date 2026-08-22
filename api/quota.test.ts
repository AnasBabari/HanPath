import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAndRecordQuota, QuotaStoreUnavailableError, QUOTA_LIMITS } from './_lib/quota';

vi.mock('./_lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from './_lib/supabaseAdmin';

describe('Quota Rate-Limiting & Production Fail-Closed Boundary', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('enforces in-memory limits in dev/test mode for guests', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);

    const guestId = 'guest:test-dev-guest-1';
    for (let i = 0; i < QUOTA_LIMITS.guest.daily; i++) {
      const res = await checkAndRecordQuota(guestId, true);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(5);
      expect(res.remaining).toBe(5 - (i + 1));
    }

    // Next request exceeds daily limit
    const exceeded = await checkAndRecordQuota(guestId, true);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.remaining).toBe(0);
    expect(exceeded.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('calls Supabase RPC when available', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        allowed: true,
        remaining_daily: 45,
        reset_at: '2026-08-23T00:00:00.000Z',
      },
      error: null,
    });

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      rpc: mockRpc,
    } as any);

    const res = await checkAndRecordQuota('user:test-user-1', false);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(45);
    expect(mockRpc).toHaveBeenCalledWith('record_and_check_ai_quota', {
      p_identifier: 'user:test-user-1',
      p_max_daily: 50,
      p_max_minute: 10,
    });
  });

  it('enforces a second network quota bucket for guest identity rotation', async () => {
    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { allowed: true, remaining_daily: 4 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { allowed: false, remaining_daily: 0, retry_after_seconds: 30 },
        error: null,
      });

    vi.mocked(getSupabaseAdmin).mockReturnValue({ rpc: mockRpc } as any);

    const result = await checkAndRecordQuota('guest:rotated-id', true, 'opaque-network-hash');
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(QUOTA_LIMITS.guest.daily);
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'record_and_check_ai_quota', {
      p_identifier: 'network:opaque-network-hash',
      p_max_daily: QUOTA_LIMITS.guestNetwork.daily,
      p_max_minute: QUOTA_LIMITS.guestNetwork.minute,
    });
  });

  it('fails closed and throws QuotaStoreUnavailableError in production when Supabase is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);

    await expect(checkAndRecordQuota('user:prod-user', false)).rejects.toThrowError(
      QuotaStoreUnavailableError
    );
  });

  it('fails closed and throws QuotaStoreUnavailableError in production when RPC returns error', async () => {
    process.env.NODE_ENV = 'production';
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'connection pool exhausted' },
    });

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      rpc: mockRpc,
    } as any);

    await expect(checkAndRecordQuota('user:prod-user', false)).rejects.toThrowError(
      QuotaStoreUnavailableError
    );
  });
});
