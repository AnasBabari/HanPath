import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LearnPage from '../LearnPage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';
import { buildCurriculum } from '../../utils/curriculum';
import type { HSKWord } from '../../types';

describe('LearnPage Feature Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    snap.stats.totalXP = 50;

    const mockWords: HSKWord[] = [
      { id: 'hsk1-1', hanzi: '你', pinyin: 'nǐ', meanings: ['you'], hskLevel: 1 },
      { id: 'hsk1-2', hanzi: '好', pinyin: 'hǎo', meanings: ['good'], hskLevel: 1 },
    ];

    const mockUnits = buildCurriculum(mockWords, []);

    useStore.setState({
      snapshot: snap,
      hskLevel: 1,
      units: mockUnits,
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

  it('renders curriculum units, tracks progress bar, and starts a lesson', async () => {
    render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Unit 1: Foundation')).toBeInTheDocument();
    expect(screen.getByText('Start Learning')).toBeInTheDocument();

    // Click Start Learning on timeline banner to open lesson preview
    const startBtn = screen.getByText('Start Learning');
    fireEvent.click(startBtn);

    // Preview modal shows Start Lesson button
    const startLessonBtn = await screen.findByText('Start Lesson');
    fireEvent.click(startLessonBtn);

    // ExerciseRunner mounts
    expect(await screen.findByText('Check Answer')).toBeInTheDocument();
  });
});
