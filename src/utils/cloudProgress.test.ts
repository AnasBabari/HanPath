import { describe, expect, it } from 'vitest';
import type { UserStats } from '../types';
import { reconcileProgress } from './cloudProgress';

const stats = (totalXP: number, streak = 0, completedLessons: string[] = []): UserStats => ({
  totalXP,
  level: Math.floor(totalXP / 100) + 1,
  streak,
  longestStreak: streak,
  completedLessons,
  wordsLearned: completedLessons.length * 4,
  totalCorrect: totalXP / 10,
  totalAttempted: totalXP / 10,
  lessonsCompletedToday: completedLessons.length,
  dailyGoalMinutes: 10,
  minutesStudiedToday: 5,
  lastStudyDate: '2026-08-14',
  lastSessionStart: null,
  unlockedAchievements: [],
  revealPinyin: 'always',
  wordAccuracy: {},
  wordSRS: {},
  xpToday: totalXP,
  perfectLessonsToday: 0,
  streakExtendedToday: false,
  readStories: [],
});

describe('Cloud Progress Reconciliation & Conflict Engine', () => {
  it('handles local data present when cloud is completely absent (first sync)', () => {
    const local = stats(50, 1, ['u1-l1']);
    const result = reconcileProgress(local, '2026-08-14T10:00:00.000Z', null);
    expect(result.source).toBe('local');
    expect(result.stats.totalXP).toBe(50);
    expect(result.updatedAt).toBe('2026-08-14T10:00:00.000Z');
  });

  it('keeps a strictly newer local snapshot when local timestamp > cloud timestamp', () => {
    const local = stats(120, 2, ['u1-l1', 'u1-l2']);
    const cloud = {
      stats: stats(70, 1, ['u1-l1']),
      updatedAt: '2026-08-14T10:00:00.000Z',
    };

    const result = reconcileProgress(local, '2026-08-14T10:05:00.000Z', cloud);
    expect(result.source).toBe('local');
    expect(result.stats.totalXP).toBe(120);
    expect(result.stats.completedLessons).toHaveLength(2);
  });

  it('hydrates a strictly newer cloud snapshot when cloud timestamp > local timestamp', () => {
    const local = stats(50, 1, ['u1-l1']);
    const cloud = {
      stats: stats(250, 5, ['u1-l1', 'u1-l2', 'u1-l3']),
      updatedAt: '2026-08-14T11:00:00.000Z',
    };

    const result = reconcileProgress(local, '2026-08-14T09:00:00.000Z', cloud);
    expect(result.source).toBe('cloud');
    expect(result.stats.totalXP).toBe(250);
    expect(result.stats.completedLessons).toHaveLength(3);
  });

  it('uses cloud on equal timestamps for deterministic multi-device convergence', () => {
    const timestamp = '2026-08-14T12:00:00.000Z';
    const local = stats(100);
    const cloud = {
      stats: stats(150),
      updatedAt: timestamp,
    };

    const result = reconcileProgress(local, timestamp, cloud);
    expect(result.source).toBe('cloud');
    expect(result.stats.totalXP).toBe(150);
  });

  it('handles invalid or corrupt local timestamps safely by defaulting to cloud or fallback', () => {
    const local = stats(30);
    const cloud = {
      stats: stats(80),
      updatedAt: '2026-08-14T10:00:00.000Z',
    };

    const result = reconcileProgress(local, 'not-a-valid-date', cloud);
    expect(result.source).toBe('cloud');
    expect(result.stats.totalXP).toBe(80);
  });

  it('generates a fallback timestamp if local is missing and cloud is null', () => {
    const local = stats(10);
    const result = reconcileProgress(local, null, null);
    expect(result.source).toBe('local');
    expect(typeof result.updatedAt).toBe('string');
    expect(Date.parse(result.updatedAt)).toBeGreaterThan(0);
  });
});
