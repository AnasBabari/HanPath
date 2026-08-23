import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders Profile page with stats and local storage active', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Local Storage Active')).toBeInTheDocument();
    expect(screen.getByText('Day Streak')).toBeInTheDocument();
    expect(screen.getByText('Total XP')).toBeInTheDocument();
  });

  it('triggers reset local progress confirmation text input and submission', async () => {
    const resetLocalProgressMock = vi.fn();
    useStore.setState({ resetLocalProgress: resetLocalProgressMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const resetBtn = screen.getByText('Reset Local Progress');
    fireEvent.click(resetBtn);

    const input = screen.getByPlaceholderText('RESET');
    fireEvent.change(input, { target: { value: 'RESET' } });

    const confirmBtn = screen.getByRole('button', { name: 'Reset Progress' });
    fireEvent.click(confirmBtn);

    expect(resetLocalProgressMock).toHaveBeenCalled();
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

  it('switches HSK level between HSK 1 and HSK 2', () => {
    const setHSKLevelMock = vi.fn();
    useStore.setState({ setHSKLevel: setHSKLevelMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const hsk2Btn = screen.getByRole('button', { name: 'HSK 2' });
    fireEvent.click(hsk2Btn);

    expect(setHSKLevelMock).toHaveBeenCalledWith(2);
  });
});
