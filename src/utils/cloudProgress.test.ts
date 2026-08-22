import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCloudProgress, syncCloudProgress, deleteCloudAccount } from './cloudProgress';
import { createDefaultProgressSnapshotV4 } from './progressSchema';
import type { SyncEnvelope } from '../types';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cloud Progress Client Sync', () => {
  it('fetches cloud progress and validates schema successfully', async () => {
    const mockEnvelope: SyncEnvelope = {
      snapshot: createDefaultProgressSnapshotV4(),
      version: 3,
      updatedAt: '2026-08-22T10:00:00Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockEnvelope,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCloudProgress('mock-auth-token');
    expect(result).toBeDefined();
    expect(result?.version).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith('/api/progress', expect.objectContaining({
      headers: { Authorization: 'Bearer mock-auth-token' },
    }));
  });

  it('returns null when 404 is received (no existing cloud progress)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCloudProgress('mock-auth-token');
    expect(result).toBeNull();
  });

  it('handles 409 conflict by re-merging local and cloud state and retrying once', async () => {
    const local = createDefaultProgressSnapshotV4();
    local.hskLevelProgress[1].completedLessons = ['lesson-1'];

    const cloudSnapshot = createDefaultProgressSnapshotV4();
    cloudSnapshot.hskLevelProgress[1].completedLessons = ['lesson-2'];

    const conflictEnvelope: SyncEnvelope = {
      snapshot: cloudSnapshot,
      version: 2,
      updatedAt: '2026-08-22T09:00:00Z',
    };

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      callCount++;
      if (callCount === 1) {
        // First call returns 409 Conflict
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ currentEnvelope: conflictEnvelope }),
        });
      }
      // Retry call returns 200 OK
      const sentBody = JSON.parse(init.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          snapshot: sentBody.snapshot,
          version: 3,
          updatedAt: '2026-08-22T10:00:00Z',
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncCloudProgress('token', local, 1);
    expect(result.success).toBe(true);
    expect(result.isConflictResolved).toBe(true);
    expect(callCount).toBe(2);
    expect(result.mergedSnapshot?.hskLevelProgress[1].completedLessons).toContain('lesson-1');
    expect(result.mergedSnapshot?.hskLevelProgress[1].completedLessons).toContain('lesson-2');
  });

  it('deletes cloud account successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await deleteCloudAccount('token');
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/account', expect.objectContaining({
      method: 'DELETE',
    }));
  });
});
