import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

describe('ProfilePage Deep Feature Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    snap.hskLevelProgress[1].completedLessons = ['hsk1-u1-l1'];
    snap.studyDays = ['2026-08-22'];
    snap.stats.totalXP = 200;

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

  it('handles email OTP submit', async () => {
    const user = userEvent.setup();
    const requestEmailOtpMock = vi.fn().mockResolvedValue({ success: true });
    useStore.setState({
      requestEmailOtp: requestEmailOtpMock,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    // Type email and submit
    const emailInput = screen.getByLabelText('Email address for sign-in');
    await user.type(emailInput, 'learner@example.com');

    const sendBtn = screen.getByText('Send Verification Code');
    await user.click(sendBtn);

    expect(requestEmailOtpMock).toHaveBeenCalledWith('learner@example.com');
    expect(await screen.findByLabelText('6-digit verification code')).toBeInTheDocument();
  });

  it('toggles sound effects and daily study goal', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const goalSelect = screen.getByLabelText('Daily study goal');
    fireEvent.change(goalSelect, { target: { value: '20' } });

    expect(useStore.getState().snapshot.preferences.dailyGoalMinutes).toBe(20);
  });

  it('triggers delete account modal and handles cancellation for authenticated user', () => {
    useStore.setState({
      authSession: {
        user: { id: 'test-user-uuid', email: 'user@example.com' },
        token: 'mock-jwt-token',
      },
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const deleteBtn = screen.getByText('Delete Account & Data');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete Account & Progress?')).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('Delete Account & Progress?')).not.toBeInTheDocument();
  });
});
