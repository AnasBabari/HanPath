import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
      storageStatus: 'healthy',
      storageError: null,
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

  it('renders storage error badge when localStorage fails', () => {
    useStore.setState({
      storageStatus: 'error',
      storageError: 'Quota exceeded',
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Storage Error (Not Saved)')).toBeInTheDocument();
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

  it('opens confirmation modal and restores backup on confirmation', async () => {
    const importProgressJSONMock = vi.fn().mockReturnValue({ success: true });
    useStore.setState({ importProgressJSON: importProgressJSONMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const candidateSnap = createDefaultProgressSnapshotV4();
    candidateSnap.stats.totalXP = 500;
    const file = new File([JSON.stringify(candidateSnap)], 'backup.json', { type: 'application/json' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Expect modal to appear with preview
    expect(await screen.findByText('Replace Current Progress?')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();

    // Click Restore Backup
    const restoreBtn = screen.getByRole('button', { name: 'Restore Backup' });
    fireEvent.click(restoreBtn);

    expect(importProgressJSONMock).toHaveBeenCalled();
  });

  it('rejects backup files exceeding 2 MB', async () => {
    const setToastMock = vi.fn();
    useStore.setState({ setToast: setToastMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const largeFile = new File(['x'.repeat(100)], 'huge.json', { type: 'application/json' });
    Object.defineProperty(largeFile, 'size', { value: 3 * 1024 * 1024 });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(setToastMock).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum allowed size'));
    });
  });
});
