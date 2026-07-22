import { describe, it, expect } from 'vitest';
import { xpForLevel, levelFromXP, addXP } from '../gamification';
import type { UserStats } from '../../types';

describe('Gamification Logic', () => {
  it('calculates correct XP for levels', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBeGreaterThan(100);
  });

  it('determines level from cumulative XP', () => {
    expect(levelFromXP(50)).toBe(1);
    expect(levelFromXP(100)).toBe(2);
    expect(levelFromXP(215)).toBe(3); // 100 + 115
  });

  it('adds XP and updates level in stats', () => {
    const stats: UserStats = {
      totalXP: 0, level: 1, streak: 0, longestStreak: 0,
      completedLessons: [], wordsLearned: 0, totalCorrect: 0, totalAttempted: 0,
      lessonsCompletedToday: 0, dailyGoalMinutes: 10, minutesStudiedToday: 0,
      lastStudyDate: null, lastSessionStart: null, unlockedAchievements: [],
      revealPinyin: 'always', wordAccuracy: {}, wordSRS: {}, xpToday: 0,
      perfectLessonsToday: 0, streakExtendedToday: false, readStories: []
    };

    const updated = addXP(stats, 150);
    expect(updated.totalXP).toBe(150);
    expect(updated.level).toBe(2);
  });
});
