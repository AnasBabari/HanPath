import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  totalXPForLevel,
  levelFromXP,
  xpProgress,
  bumpStreak,
  addXP,
  checkNewAchievements,
  loadStats,
  resetAll,
} from '../gamification';

describe('Gamification Engine Deep Coverage', () => {
  it('calculates level, next level XP, and progress fraction accurately', () => {
    expect(levelFromXP(0)).toBe(1);
    expect(levelFromXP(100)).toBe(2);
    expect(xpForLevel(1)).toBe(100);
    expect(totalXPForLevel(2)).toBe(100);

    const progress = xpProgress(50);
    expect(progress.current).toBe(50);
    expect(progress.needed).toBe(100);
    expect(progress.percent).toBe(50);
  });

  it('bumps streak and awards XP to UserStats model', () => {
    const initialStats = loadStats();
    expect(initialStats.level).toBe(1);

    const withXP = addXP(initialStats, 150);
    expect(withXP.totalXP).toBe(150);
    expect(withXP.level).toBe(2);

    const streakBumped = bumpStreak(withXP);
    expect(streakBumped.streak).toBe(1);

    const achievements = checkNewAchievements(withXP);
    expect(Array.isArray(achievements)).toBe(true);

    expect(() => resetAll()).not.toThrow();
  });
});
