import { describe, expect, it } from 'vitest';
import type { UserStats } from '../types';
import { reconcileProgress } from './cloudProgress';

const stats = (totalXP: number): UserStats => ({
  totalXP,
  level: 1,
  streak: 0,
  longestStreak: 0,
  completedLessons: [],
  wordsLearned: 0,
  totalCorrect: 0,
  totalAttempted: 0,
  lessonsCompletedToday: 0,
  dailyGoalMinutes: 10,
  minutesStudiedToday: 0,
  lastStudyDate: null,
  lastSessionStart: null,
  unlockedAchievements: [],
  revealPinyin: 'always',
  wordAccuracy: {},
  wordSRS: {},
  xpToday: 0,
  perfectLessonsToday: 0,
  streakExtendedToday: false,
  readStories: [],
});

describe('cloud progress reconciliation', () => {
  it('keeps a strictly newer local snapshot', () => {
    const result = reconcileProgress(stats(20), '2026-08-12T10:01:00.000Z', {
      stats: stats(10),
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
    expect(result.source).toBe('local');
    expect(result.stats.totalXP).toBe(20);
  });

  it('hydrates a newer cloud snapshot', () => {
    const result = reconcileProgress(stats(20), '2026-08-12T10:00:00.000Z', {
      stats: stats(30),
      updatedAt: '2026-08-12T10:01:00.000Z',
    });
    expect(result.source).toBe('cloud');
    expect(result.stats.totalXP).toBe(30);
  });

  it('uses cloud on equal timestamps for deterministic convergence', () => {
    const result = reconcileProgress(stats(20), '2026-08-12T10:00:00.000Z', {
      stats: stats(30),
      updatedAt: '2026-08-12T10:00:00.000Z',
    });
    expect(result.source).toBe('cloud');
  });
});
