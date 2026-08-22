import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore, deriveUserStats } from '../useStore';
import * as cloudProgress from '../../utils/cloudProgress';
import * as supabaseLib from '../../utils/supabase';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

describe('useStore Auth and Cloud Sync Actions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    const snap = createDefaultProgressSnapshotV4();
    useStore.setState({
      snapshot: snap,
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
      stats: deriveUserStats(snap, 1),
    });
  });

  it('sets error, toast, fullscreen, and chat history', () => {
    const { setError, setToast, setFullScreen, addChatMessage, clearChatHistory, setHSKLevel } = useStore.getState();

    setError('Network error');
    expect(useStore.getState().error).toBe('Network error');

    setToast('Saved successfully');
    expect(useStore.getState().toast).toBe('Saved successfully');

    setFullScreen(true);
    expect(useStore.getState().isFullScreen).toBe(true);

    setHSKLevel(2);
    expect(useStore.getState().hskLevel).toBe(2);

    addChatMessage({ role: 'user', content: 'Hello' });
    addChatMessage({ role: 'model', content: 'Hi there!' });
    expect(useStore.getState().chatHistory.length).toBe(2);

    clearChatHistory();
    expect(useStore.getState().chatHistory.length).toBe(0);
  });

  it('handles requestEmailOtp, verifyEmailOtp, and signOut flows', async () => {
    const mockSignInWithOtp = vi.fn().mockResolvedValue({ error: null });
    const mockVerifyOtp = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'test-user-id', email: 'test@example.com' },
        session: { access_token: 'valid-jwt-token' },
      },
      error: null,
    });
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(supabaseLib, 'getSupabaseClientAsync').mockResolvedValue({
      auth: {
        signInWithOtp: mockSignInWithOtp,
        verifyOtp: mockVerifyOtp,
        signOut: mockSignOut,
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: 'test-user-id', email: 'test@example.com' },
              access_token: 'valid-jwt-token',
            },
          },
        }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
    } as any);

    vi.spyOn(cloudProgress, 'fetchCloudProgress').mockResolvedValue(null);
    vi.spyOn(cloudProgress, 'syncCloudProgress').mockResolvedValue({
      success: true,
      envelope: {
        version: 1,
        snapshot: createDefaultProgressSnapshotV4(),
        updatedAt: '2026-08-22T10:00:00.000Z',
      },
    });

    const { requestEmailOtp, verifyEmailOtp, signOut } = useStore.getState();

    // 1. Request OTP
    const reqRes = await requestEmailOtp('test@example.com');
    expect(reqRes.success).toBe(true);

    // 2. Verify OTP
    const verifyRes = await verifyEmailOtp('test@example.com', '123456');
    expect(verifyRes.success).toBe(true);
    expect(useStore.getState().authSession.user?.email).toBe('test@example.com');

    // 3. Sign Out
    await signOut();
    expect(useStore.getState().authSession.user).toBeNull();
  });

  it('performs manual sync with cloud progress client', async () => {
    useStore.setState({
      authSession: {
        user: { id: 'user-123', email: 'user@example.com' },
        token: 'valid-token',
      },
      isDirty: true,
      cloudVersion: 1,
    });

    vi.spyOn(cloudProgress, 'syncCloudProgress').mockResolvedValue({
      success: true,
      envelope: {
        version: 2,
        snapshot: createDefaultProgressSnapshotV4(),
        updatedAt: '2026-08-22T12:00:00.000Z',
      },
    });

    const { performSync } = useStore.getState();
    await performSync();

    expect(useStore.getState().syncStatus).toBe('synced');
    expect(useStore.getState().cloudVersion).toBe(2);
    expect(useStore.getState().isDirty).toBe(false);
  });
});
