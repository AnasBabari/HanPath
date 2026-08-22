import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore, deriveUserStats } from '../useStore';
import * as cloudProgress from '../../utils/cloudProgress';
import * as supabaseLib from '../../utils/supabase';
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
    authSession: { user: null, token: null },
    syncStatus: 'idle',
    cloudVersion: 0,
    lastSyncTime: null,
    lastSuccessfulSyncTime: null,
    lastSyncAttemptTime: null,
    isDirty: false,
    stats: deriveUserStats(snapshot, 1),
  });
}

describe('useStore failure, lifecycle, and idempotency boundaries', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
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
  });

  it('returns useful failures for unavailable and rejected authentication operations', async () => {
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue(null);
    let store = useStore.getState();
    await expect(store.requestEmailOtp('A@Example.com')).resolves.toMatchObject({ success: false });
    await expect(store.verifyEmailOtp('a@example.com', '123456')).resolves.toMatchObject({ success: false });
    await expect(store.signInWithGoogle()).resolves.toMatchObject({ success: false });

    const auth = {
      signInWithOtp: vi.fn().mockResolvedValue({ error: { message: 'email rejected' } }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: { message: 'oauth rejected' } }),
    };
    vi.mocked(supabaseLib.getSupabaseClientAsync).mockResolvedValue({ auth } as any);
    store = useStore.getState();

    await expect(store.requestEmailOtp(' A@Example.com ')).resolves.toEqual({ success: false, error: 'email rejected' });
    await expect(store.resendEmailOtp('a@example.com')).resolves.toEqual({ success: false, error: 'email rejected' });
    await expect(store.signInWithOtp('a@example.com')).resolves.toEqual({ success: false, error: 'email rejected' });
    await expect(store.verifyEmailOtp('a@example.com', '12-3')).resolves.toMatchObject({
      success: false,
      error: 'Verification code must be exactly 6 digits',
    });
    await expect(store.verifyEmailOtp('a@example.com', '123456')).resolves.toMatchObject({
      success: false,
      error: 'Invalid or expired verification code',
    });
    await expect(store.signInWithGoogle()).resolves.toEqual({ success: false, error: 'oauth rejected' });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('handles offline, signed-out, failed, and merged sync outcomes', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await useStore.getState().performSync();
    expect(useStore.getState().syncStatus).toBe('offline');

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await useStore.getState().performSync();
    expect(useStore.getState().syncStatus).toBe('idle');

    useStore.setState({
      authSession: { user: { id: 'user-1' }, token: 'token' },
      cloudVersion: 3,
    });
    vi.spyOn(cloudProgress, 'syncCloudProgress').mockResolvedValueOnce({ success: false, error: 'conflict' });
    await useStore.getState().performSync();
    expect(useStore.getState().syncStatus).toBe('error');

    const merged = createDefaultProgressSnapshotV4();
    merged.stats.totalXP = 90;
    vi.mocked(cloudProgress.syncCloudProgress).mockResolvedValueOnce({
      success: true,
      mergedSnapshot: merged,
      envelope: { snapshot: createDefaultProgressSnapshotV4(), version: 4, updatedAt: '2026-08-22T12:00:00Z' },
    });
    await useStore.getState().performSync();
    expect(useStore.getState().snapshot.stats.totalXP).toBe(90);
    expect(useStore.getState().lastSuccessfulSyncTime).toBeTruthy();
  });

  it('guards account deletion and resets local state after a successful server deletion', async () => {
    await expect(useStore.getState().deleteAccount()).resolves.toEqual({ success: false, error: 'Not authenticated' });

    useStore.setState({ authSession: { user: { id: 'user-1' }, token: 'token' } });
    vi.spyOn(cloudProgress, 'deleteCloudAccount').mockResolvedValueOnce({ success: false, error: 'server refused' });
    await expect(useStore.getState().deleteAccount()).resolves.toEqual({ success: false, error: 'server refused' });

    const signOut = vi.fn().mockRejectedValue(new Error('already deleted'));
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({ auth: { signOut } } as any);
    vi.mocked(cloudProgress.deleteCloudAccount).mockResolvedValueOnce({ success: true });
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    await expect(useStore.getState().deleteAccount()).resolves.toEqual({ success: true });
    expect(useStore.getState().authSession.user).toBeNull();
    expect(useStore.getState().toast).toContain('deleted');
    expect(signOut).toHaveBeenCalled();
    removeSpy.mockRestore();
  });

  it('initializes first-time cloud state and processes auth lifecycle events', async () => {
    type AuthCallback = (event: string, session: any) => Promise<void>;
    let authCallback: AuthCallback | undefined;
    const unsubscribe = vi.fn();
    const session = {
      user: { id: 'user-1', email: 'learner@example.com' },
      access_token: 'token-1',
    };
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn((callback: AuthCallback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    };
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({ auth } as any);
    vi.spyOn(cloudProgress, 'fetchCloudProgress')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ snapshot: createDefaultProgressSnapshotV4(), version: 5, updatedAt: '2026-08-22T00:00:00Z' });
    vi.spyOn(cloudProgress, 'syncCloudProgress')
      .mockResolvedValueOnce({ success: true, envelope: { snapshot: createDefaultProgressSnapshotV4(), version: 1, updatedAt: '2026-08-22T00:00:00Z' } })
      .mockResolvedValueOnce({ success: true });

    await useStore.getState().initAuthSession();
    expect(useStore.getState().authSession.user?.id).toBe('user-1');
    expect(useStore.getState().cloudVersion).toBe(1);

    await authCallback?.('SIGNED_IN', {
      user: { id: 'user-2', email: 'second@example.com' },
      access_token: 'token-2',
    });
    expect(useStore.getState().authSession.user?.id).toBe('user-2');
    expect(useStore.getState().cloudVersion).toBe(1);

    await authCallback?.('SIGNED_OUT', null);
    expect(useStore.getState().authSession.user).toBeNull();
    expect(useStore.getState().cloudVersion).toBe(0);
  });

  it('contains initial-session failures and signed-in merge failures', async () => {
    let authCallback: ((event: string, session: any) => Promise<void>) | undefined;
    const auth = {
      getSession: vi.fn().mockRejectedValue(new Error('session unavailable')),
      onAuthStateChange: vi.fn((callback: typeof authCallback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    };
    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({ auth } as any);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(useStore.getState().initAuthSession()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();

    auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    vi.spyOn(cloudProgress, 'fetchCloudProgress').mockRejectedValue(new Error('cloud unavailable'));
    await useStore.getState().initAuthSession();
    await authCallback?.('SIGNED_IN', {
      user: { id: 'user-3', email: 'third@example.com' },
      access_token: 'token-3',
    });
    expect(useStore.getState().authSession.user?.id).toBe('user-3');
  });
});
