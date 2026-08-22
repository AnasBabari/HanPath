import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PracticePage from '../PracticePage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';
import type { Unit } from '../../types';

describe('PracticePage Drills Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    snap.hskLevelProgress[1].completedLessons = ['hsk1-u1-l1'];
    snap.wordAccuracy = {
      'hsk1-1': { correct: 1, total: 4, lastSeen: Date.now() }, // Weak word
    };

    const mockUnits: Unit[] = [
      {
        id: 'u1',
        index: 0,
        title: 'Unit 1: Foundation',
        description: 'Greetings',
        hskLevel: 1,
        lessons: [
          {
            id: 'hsk1-u1-l1',
            unitId: 'u1',
            index: 0,
            title: 'Lesson 1',
            summary: 'Essential vocab',
            vocab: [{ id: 'hsk1-1', hanzi: '你', pinyin: 'nǐ', meaning: 'you', hskLevel: 1 }],
            exercises: [
              {
                id: 'ex-1',
                type: 'reading-meaning',
                prompt: 'What does 你 mean?',
                options: ['you', 'I', 'good', 'he'],
                answer: 'you',
                wordId: 'hsk1-1',
              },
            ],
          },
        ],
      },
    ];

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

  it('starts Tone Training drill and exits back to menu', async () => {
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    const toneBtn = screen.getByText('Tone Training');
    fireEvent.click(toneBtn);

    // Runner mounts or shows exit
    expect(await screen.findByRole('button', { name: /Exit exercise/i })).toBeInTheDocument();

    const exitBtn = screen.getByRole('button', { name: /Exit exercise/i });
    fireEvent.click(exitBtn);

    // Returns to Practice menu
    expect(await screen.findByText('Practice & Mastery')).toBeInTheDocument();
  });

  it('starts Weak Words drill and exits back to menu', async () => {
    render(
      <MemoryRouter>
        <PracticePage />
      </MemoryRouter>
    );

    const weakBtn = screen.getByText('Weak Word Focus');
    fireEvent.click(weakBtn);

    expect(await screen.findByRole('button', { name: /Exit exercise/i })).toBeInTheDocument();
  });
});
