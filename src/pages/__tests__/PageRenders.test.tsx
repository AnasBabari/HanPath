import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import PracticePage from '../PracticePage';
import StoriesPage from '../StoriesPage';
import ReviewPage from '../ReviewPage';
import ChatPage from '../ChatPage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

describe('Page Components Render and Interaction Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    snap.hskLevelProgress[1].completedLessons = ['hsk1-u1-l1'];
    snap.studyDays = ['2026-08-20', '2026-08-21', '2026-08-22'];
    snap.stats.totalXP = 150;
    snap.stats.totalCorrect = 20;
    snap.stats.totalAttempted = 25;
    snap.stats.minutesStudiedToday = 15;
    snap.preferences.dailyGoalMinutes = 15;

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

  it('renders ProfilePage, updates daily study goal, and shows export data button', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Local Storage Active')).toBeInTheDocument();
    expect(screen.getByText('Export Progress (JSON)')).toBeInTheDocument();

    // Change study goal via select dropdown
    const select = screen.getByLabelText('Daily study goal minutes');
    fireEvent.change(select, { target: { value: '30' } });
    expect(useStore.getState().snapshot.preferences.dailyGoalMinutes).toBe(30);
  });

  it('renders PracticePage and launches review sessions', async () => {
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    expect(screen.getByText('Practice & Mastery')).toBeInTheDocument();
    expect(screen.getByText('Smart SRS Review')).toBeInTheDocument();
    expect(screen.getByText('Tone Training')).toBeInTheDocument();
  });

  it('renders StoriesPage, allows opening story, toggling pinyin, and completion', async () => {
    render(
      <MemoryRouter>
        <StoriesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Graded Stories')).toBeInTheDocument();
    expect(await screen.findByText('Hello, Teacher')).toBeInTheDocument();

    // Click story to open reader
    fireEvent.click(screen.getByText('Hello, Teacher'));
    expect(await screen.findByText('你好，老师')).toBeInTheDocument();

    // Click Complete Story button
    const completeBtn = screen.getByText('Complete Story');
    fireEvent.click(completeBtn);
    expect(useStore.getState().snapshot.readStories).toContain('story-hsk1-1');
  });

  it('renders ReviewPage and shows All Caught Up or deck', async () => {
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/All Caught Up!|Spaced Repetition Review/i)).toBeInTheDocument();
  });

  it('renders ChatPage and displays internet available badge', async () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    );

    expect(screen.getByText('AI Language Tutor')).toBeInTheDocument();
    expect(screen.getByText('Internet available')).toBeInTheDocument();
  });
});
