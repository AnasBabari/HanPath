import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCloudProgress,
  syncCloudProgress,
  deleteCloudAccount,
} from '../cloudProgress';
import { createDefaultProgressSnapshotV4 } from '../progressSchema';

describe('Cloud Progress API Client Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles fetchCloudProgress on 200, 404, and errors', async () => {
    const validSnapshot = createDefaultProgressSnapshotV4();

    // 200 Success
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          version: 2,
          snapshot: validSnapshot,
          updatedAt: '2026-08-22T10:00:00.000Z',
        }),
      })
    );

    const res200 = await fetchCloudProgress('valid-token');
    expect(res200).not.toBeNull();
    expect(res200?.version).toBe(2);

    // 404 Not Found
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      })
    );

    const res404 = await fetchCloudProgress('valid-token');
    expect(res404).toBeNull();
  });

  it('handles syncCloudProgress on 200 and 409 conflict', async () => {
    const validSnapshot = createDefaultProgressSnapshotV4();

    // 200 Success
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          version: 3,
          snapshot: validSnapshot,
          updatedAt: '2026-08-22T12:00:00.000Z',
        }),
      })
    );

    const res200 = await syncCloudProgress('valid-token', validSnapshot, 2);
    expect(res200.success).toBe(true);
    expect(res200.envelope?.version).toBe(3);

    // 409 Conflict with auto-resolution
    const mockConflictFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          currentEnvelope: {
            version: 5,
            snapshot: validSnapshot,
            updatedAt: '2026-08-22T12:30:00.000Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          version: 6,
          snapshot: validSnapshot,
          updatedAt: '2026-08-22T12:35:00.000Z',
        }),
      });

    vi.stubGlobal('fetch', mockConflictFetch);

    const res409 = await syncCloudProgress('valid-token', validSnapshot, 2);
    expect(res409.success).toBe(true);
    expect(res409.isConflictResolved).toBe(true);
  });

  it('handles deleteCloudAccount on success and error', async () => {
    // 200 Success
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
    );

    const res200 = await deleteCloudAccount('valid-token');
    expect(res200.success).toBe(true);

    // 500 Error
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })
    );

    const res500 = await deleteCloudAccount('valid-token');
    expect(res500.success).toBe(false);
  });
});
