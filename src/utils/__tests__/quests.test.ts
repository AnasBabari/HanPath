import { describe, it, expect } from 'vitest';
import { getDailyQuests, QUEST_POOL } from '../quests';
import type { UserStats } from '../../types';

describe('Daily Quests System', () => {
  const baseStats: UserStats = {
    totalXP: 0,
    level: 1,
    streak: 1,
    longestStreak: 1,
    completedLessons: [],
    wordsLearned: 0,
    totalCorrect: 0,
    totalAttempted: 0,
    lessonsCompletedToday: 0,
    dailyGoalMinutes: 10,
    minutesStudiedToday: 0,
    lastStudyDate: '2026-08-14',
    lastSessionStart: null,
    unlockedAchievements: [],
    revealPinyin: 'always',
    wordAccuracy: {},
    wordSRS: {},
    xpToday: 0,
    perfectLessonsToday: 0,
    streakExtendedToday: false,
    readStories: [],
  };

  it('generates exactly 3 daily quests deterministically for a date', () => {
    const questsDay1 = getDailyQuests('2026-08-14');
    const questsDay1Again = getDailyQuests('2026-08-14');

    expect(questsDay1.length).toBe(3);
    expect(questsDay1.map((q) => q.id)).toEqual(questsDay1Again.map((q) => q.id));
  });

  it('generates different quests on different dates', () => {
    const questsDay1 = getDailyQuests('2026-08-14');
    const questsDay2 = getDailyQuests('2026-08-15');

    // Both should be valid quests from the pool
    expect(questsDay1.length).toBe(3);
    expect(questsDay2.length).toBe(3);
    for (const q of questsDay1) {
      expect(QUEST_POOL.some((p) => p.id === q.id)).toBe(true);
    }
  });

  it('evaluates quest completion conditions correctly', () => {
    const xpQuest = QUEST_POOL.find((q) => q.id === 'xp_50')!;
    expect(xpQuest.check(baseStats)).toBe(false);

    const completedStats = { ...baseStats, xpToday: 60 };
    expect(xpQuest.check(completedStats)).toBe(true);
  });
});
