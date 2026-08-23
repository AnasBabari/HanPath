import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore, deriveUserStats, saveSnapshotToStorage, loadSnapshotFromStorage, APP_STORAGE_KEY } from '../useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

function resetStore() {
  const snapshot = createDefaultProgressSnapshotV4();
  useStore.setState({
    snapshot,
    hskLevel: 1,
    units: null,
    loading: false,
    isFullScreen: false,
    error: null,
    toast: null,
    adminMode: false,
    chatHistory: [],
    storageStatus: 'healthy',
    storageError: null,
    stats: deriveUserStats(snapshot, 1),
  });
}

describe('useStore local-first persistence, storage failure, and boundary handling', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    resetStore();
  });

  it('keeps achievements and stories idempotent while updating auxiliary state', () => {
    const store = useStore.getState();
    store.setUnits([]);
    store.setLoading(true);
    store.addXP(50);
    store.unlockAchievement('first-lesson');
    store.unlockAchievement('first-lesson');
    store.markStoryRead('story-1');
    store.markStoryRead('story-1');

    const state = useStore.getState();
    expect(state.loading).toBe(true);
    expect(state.units).toEqual([]);
    expect(state.snapshot.stats.totalXP).toBe(50);
    expect(state.snapshot.unlockedAchievements).toEqual(['first-lesson']);
    expect(state.snapshot.readStories).toEqual(['story-1']);
    expect(state.storageStatus).toBe('healthy');
  });

  it('detects and flags storage write failures when localStorage.setItem throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: storage limit reached');
    });

    const store = useStore.getState();
    store.addXP(100);

    const state = useStore.getState();
    expect(state.storageStatus).toBe('error');
    expect(state.storageError).toContain('QuotaExceededError');

    // Test direct helper return value
    const result = saveSnapshotToStorage(APP_STORAGE_KEY, state.snapshot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('QuotaExceededError');

    // Restore localStorage functionality
    setItemSpy.mockRestore();

    // Next successful save clears error and recovers health
    store.addXP(25);
    const recoveredState = useStore.getState();
    expect(recoveredState.storageStatus).toBe('healthy');
    expect(recoveredState.storageError).toBeNull();
  });

  it('handles corrupted localStorage JSON gracefully on load', () => {
    localStorage.setItem(APP_STORAGE_KEY, '{ invalid json');
    const snapshot = loadSnapshotFromStorage(APP_STORAGE_KEY);
    expect(snapshot).toBeDefined();
    expect(snapshot.schemaVersion).toBe(4);
    expect(snapshot.stats.totalXP).toBe(0);
  });

  it('resets local progress cleanly and purges legacy keys', () => {
    localStorage.setItem('hanpath:user:old-user-123:progress_v4', '{"fake": true}');
    localStorage.setItem('hanpath:guest:progress_v4', '{"fake": true}');
    useStore.getState().addXP(500);

    useStore.getState().resetLocalProgress();

    expect(useStore.getState().stats.totalXP).toBe(0);
    expect(localStorage.getItem('hanpath:user:old-user-123:progress_v4')).toBeNull();
    expect(localStorage.getItem('hanpath:guest:progress_v4')).toBeNull();
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeTruthy();
  });
});
