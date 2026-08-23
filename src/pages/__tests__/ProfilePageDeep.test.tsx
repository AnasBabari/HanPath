import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      storageStatus: 'healthy',
      storageError: null,
      stats: deriveUserStats(snap, 1),
    });
  });

  it('changes daily study goal minutes', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const goalSelect = screen.getByLabelText('Daily study goal minutes');
    fireEvent.change(goalSelect, { target: { value: '20' } });

    expect(useStore.getState().snapshot.preferences.dailyGoalMinutes).toBe(20);
  });

  it('changes pinyin visibility preference', () => {
    const setRevealPinyinMock = vi.fn();
    useStore.setState({ setRevealPinyin: setRevealPinyinMock });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const pinyinSelect = screen.getByLabelText('Pinyin display preference');
    fireEvent.change(pinyinSelect, { target: { value: 'peek' } });

    expect(setRevealPinyinMock).toHaveBeenCalledWith('peek');
  });

  it('triggers reset progress modal and handles cancellation & Escape key', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const resetBtn = screen.getByText('Reset Local Progress');
    fireEvent.click(resetBtn);

    expect(screen.getByText('Reset Local Progress?')).toBeInTheDocument();

    // Dismiss with Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Reset Local Progress?')).not.toBeInTheDocument();

    // Reopen and cancel with button
    fireEvent.click(resetBtn);
    expect(screen.getByText('Reset Local Progress?')).toBeInTheDocument();
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(screen.queryByText('Reset Local Progress?')).not.toBeInTheDocument();
  });
});
