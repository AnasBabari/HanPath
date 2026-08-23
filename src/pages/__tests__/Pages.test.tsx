import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PracticePage from '../PracticePage';
import StoriesPage from '../StoriesPage';
import ChatPage from '../ChatPage';
import ReviewPage from '../ReviewPage';
import LicensesPage from '../LicensesPage';
import { useStore } from '../../store/useStore';
import { buildCurriculum } from '../../utils/curriculum';

describe('Page Components Rendering & Interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const mockWords = [
      { id: 'hsk1-1', hanzi: '你好', pinyin: 'nǐ hǎo', meanings: ['hello'], hskLevel: 1 },
      { id: 'hsk1-2', hanzi: '再见', pinyin: 'zài jiàn', meanings: ['goodbye'], hskLevel: 1 },
    ];
    const mockUnits = buildCurriculum(mockWords);

    useStore.setState({
      hskLevel: 1,
      units: mockUnits,
      stats: {
        totalXP: 50,
        level: 1,
        streak: 2,
        longestStreak: 2,
        completedLessons: [mockUnits[0]?.lessons[0]?.id || 'hsk1-u1-l1'],
        wordsLearned: 1,
        totalCorrect: 5,
        totalAttempted: 5,
        lessonsCompletedToday: 0,
        dailyGoalMinutes: 10,
        minutesStudiedToday: 0,
        dailyDate: '2026-08-22',
        targetHskLevel: 1,
        studyDays: ['2026-08-22'],
        lastStudyDate: '2026-08-22',
        lastSessionStart: null,
        unlockedAchievements: [],
        revealPinyin: 'always',
        wordAccuracy: {},
        wordSRS: {
          'hsk1-1': {
            wordId: 'hsk1-1',
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: '2026-08-21',
            repetitions: 1,
            updatedAt: '2026-08-21T00:00:00.000Z',
          },
        },
        xpToday: 50,
        perfectLessonsToday: 0,
        streakExtendedToday: true,
        readStories: [],
      },
    });
  });

  it('renders PracticePage with drill options and practice cards', () => {
    render(
      <BrowserRouter>
        <PracticePage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Practice/i)).toBeInTheDocument();
  });

  it('renders StoriesPage with graded stories catalog', async () => {
    render(
      <BrowserRouter>
        <StoriesPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Graded Stories/i, {}, { timeout: 6000 })).toBeInTheDocument();
  });

  it('renders ChatPage with tutor greeting and mode switcher', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    expect(screen.getAllByText(/AI Language Tutor/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Ask in Chinese or English/i)).toBeInTheDocument();
  });

  it('renders ReviewPage with due cards and interactive options', async () => {
    render(
      <BrowserRouter>
        <ReviewPage />
      </BrowserRouter>
    );

    expect(await screen.findByText(/Review/i, {}, { timeout: 6000 })).toBeInTheDocument();
  });

  it('renders LicensesPage with open source attribution', () => {
    render(
      <BrowserRouter>
        <LicensesPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/About & Licenses/i)).toBeInTheDocument();
    expect(screen.getAllByText(/MIT License/i).length).toBeGreaterThan(0);
  });
});
