import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

describe('ProfilePage Full Interactive Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    snap.hskLevelProgress[1].completedLessons = ['hsk1-u1-l1'];
    snap.stats.totalXP = 300;
    snap.unlockedAchievements = ['first-lesson'];

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
      authSession: {
        user: { id: 'test-user-id', email: 'user@example.com' },
        token: 'valid-jwt-token',
      },
      syncStatus: 'synced',
      cloudVersion: 2,
      lastSyncTime: '12:00 PM',
      lastSuccessfulSyncTime: '12:00 PM',
      lastSyncAttemptTime: '12:00 PM',
      isDirty: false,
      stats: deriveUserStats(snap, 1),
    });
  });

  it('handles sign out button click', async () => {
    const signOutMock = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ signOut: signOutMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const signOutBtn = screen.getByText('Sign Out');
    fireEvent.click(signOutBtn);

    expect(signOutMock).toHaveBeenCalled();
  });

  it('handles manual cloud sync trigger button', async () => {
    const performSyncMock = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ performSync: performSyncMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const syncBtn = screen.getByLabelText('Manual Cloud Sync');
    fireEvent.click(syncBtn);

    expect(performSyncMock).toHaveBeenCalled();
  });

  it('triggers delete account confirmation text input and submission', async () => {
    const deleteAccountMock = vi.fn().mockResolvedValue({ success: true });
    useStore.setState({ deleteAccount: deleteAccountMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const deleteBtn = screen.getByText('Delete Account & Data');
    fireEvent.click(deleteBtn);

    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    const confirmBtn = screen.getByText('Permanently Delete');
    fireEvent.click(confirmBtn);

    expect(deleteAccountMock).toHaveBeenCalled();
  });

  it('handles progress JSON export trigger', () => {
    const exportProgressJSONMock = vi.fn().mockReturnValue('{"schemaVersion":4}');
    useStore.setState({ exportProgressJSON: exportProgressJSONMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const exportBtn = screen.getByText('Export Progress (JSON)');
    fireEvent.click(exportBtn);

    expect(exportProgressJSONMock).toHaveBeenCalled();
  });

  it('handles guest sign-in with Google OAuth', () => {
    useStore.setState({
      authSession: { user: null, token: null },
    });

    const signInWithGoogleMock = vi.fn().mockResolvedValue({ success: true });
    useStore.setState({ signInWithGoogle: signInWithGoogleMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const googleBtn = screen.getByText('Continue with Google');
    fireEvent.click(googleBtn);
    expect(signInWithGoogleMock).toHaveBeenCalled();
  });
});
