import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewPage from '../ReviewPage';
import { useStore, deriveUserStats } from '../../store/useStore';
import { createDefaultProgressSnapshotV4 } from '../../utils/progressSchema';

describe('ReviewPage Deep Feature Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    const snap = createDefaultProgressSnapshotV4();
    snap.wordSRS = {
      'hsk1-1': {
        wordId: 'hsk1-1',
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: '2026-08-20', // Due
        repetitions: 1,
        updatedAt: '2026-08-20T00:00:00.000Z',
      },
    };

    useStore.setState({
      snapshot: snap,
      hskLevel: 1,
      units: [
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
              summary: 'Intro',
              vocab: [
                {
                  id: 'hsk1-1',
                  hanzi: '你',
                  pinyin: 'nǐ',
                  meaning: 'you',
                  hskLevel: 1,
                },
              ],
              exercises: [],
            },
          ],
        },
      ],
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

  it('renders review flashcard, flips card, and submits rating', async () => {
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    // See front card
    expect(await screen.findByText('你')).toBeInTheDocument();
    expect(screen.getByText('Show Answer')).toBeInTheDocument();

    // Flip card
    fireEvent.click(screen.getByText('Show Answer'));

    // Rating buttons appear: Hard, Good, Easy
    expect(screen.getByText('Good (Normal)')).toBeInTheDocument();
    expect(screen.getByText('Easy (Long)')).toBeInTheDocument();

    // Rate "Good"
    fireEvent.click(screen.getByText('Good (Normal)'));

    // Session completes
    expect(await screen.findByText(/Session Complete|All Caught Up/i)).toBeInTheDocument();
  });
});
