import { describe, it, expect } from 'vitest';
import { mergeGuestWithCloud, calculateStreakFromStudyDays } from '../progressMerge';
import { createDefaultProgressSnapshotV4, validateProgressSnapshotV4 } from '../progressSchema';
import type { ProgressSnapshotV4 } from '../../types';

describe('Progress Merge & Streak Engine', () => {
  it('calculates streaks from sorted study days accurately', () => {
    const today = new Date('2026-08-22T12:00:00Z');
    const studyDays = ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'];

    const result = calculateStreakFromStudyDays(studyDays, today);
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);

    // Broken streak
    const brokenDays = ['2026-08-10', '2026-08-11', '2026-08-22'];
    const brokenResult = calculateStreakFromStudyDays(brokenDays, today);
    expect(brokenResult.currentStreak).toBe(1);
    expect(brokenResult.longestStreak).toBe(2);
  });

  it('is completely idempotent when merging the same snapshot repeatedly', () => {
    const snapshot: ProgressSnapshotV4 = {
      schemaVersion: 4,
      hskLevelProgress: {
        1: { completedLessons: ['hsk1-u1-l1', 'hsk1-u1-l2'] },
        2: { completedLessons: ['hsk2-u1-l1'] },
      },
      studyDays: ['2026-08-21', '2026-08-22'],
      wordAccuracy: {
        'w-1': { correct: 5, total: 6, lastSeen: 1700000000 },
      },
      wordSRS: {
        'w-1': {
          wordId: 'w-1',
          interval: 6,
          easeFactor: 2.5,
          nextReviewDate: '2026-08-28',
          repetitions: 2,
          updatedAt: '2026-08-22T10:00:00Z',
        },
      },
      readStories: ['story-1'],
      unlockedAchievements: ['first_lesson'],
      stats: {
        totalXP: 150,
        longestStreak: 2,
        totalCorrect: 15,
        totalAttempted: 18,
        minutesStudiedToday: 20,
        dailyDate: '2026-08-22',
        lastStudyDate: '2026-08-22',
      },
      preferences: {
        revealPinyin: 'peek',
        targetHskLevel: 2,
        dailyGoalMinutes: 20,
      },
    };

    const firstMerge = mergeGuestWithCloud(snapshot, snapshot);
    const secondMerge = mergeGuestWithCloud(firstMerge, snapshot);

    expect(firstMerge.stats.totalXP).toBe(150);
    expect(firstMerge.wordAccuracy['w-1'].correct).toBe(5);
    expect(firstMerge.wordAccuracy['w-1'].total).toBe(6);

    expect(secondMerge.stats.totalXP).toBe(150);
    expect(secondMerge.wordAccuracy['w-1'].correct).toBe(5);
    expect(secondMerge.wordAccuracy['w-1'].total).toBe(6);

    expect(validateProgressSnapshotV4(secondMerge).success).toBe(true);
  });

  it('merges accuracy using max without double-counting on multiple merges', () => {
    const local = createDefaultProgressSnapshotV4();
    local.wordAccuracy['w-1'] = { correct: 3, total: 5, lastSeen: 100 };

    const cloud = createDefaultProgressSnapshotV4();
    cloud.wordAccuracy['w-1'] = { correct: 4, total: 4, lastSeen: 200 };

    const merged = mergeGuestWithCloud(local, cloud);

    expect(merged.wordAccuracy['w-1'].correct).toBe(4); // max(3, 4)
    expect(merged.wordAccuracy['w-1'].total).toBe(5);   // max(5, 4, 4)
    expect(merged.wordAccuracy['w-1'].lastSeen).toBe(200);

    // Re-merging with local should not sum or mutate counts
    const remerged = mergeGuestWithCloud(merged, local);
    expect(remerged.wordAccuracy['w-1'].correct).toBe(4);
    expect(remerged.wordAccuracy['w-1'].total).toBe(5);
  });

  it('selects SRS card with newer updatedAt timestamp', () => {
    const local = createDefaultProgressSnapshotV4();
    local.wordSRS['w-1'] = {
      wordId: 'w-1',
      interval: 10,
      easeFactor: 2.6,
      nextReviewDate: '2026-09-01',
      repetitions: 3,
      updatedAt: '2026-08-22T11:00:00Z', // Newer
    };

    const cloud = createDefaultProgressSnapshotV4();
    cloud.wordSRS['w-1'] = {
      wordId: 'w-1',
      interval: 1,
      easeFactor: 2.5,
      nextReviewDate: '2026-08-23',
      repetitions: 1,
      updatedAt: '2026-08-20T08:00:00Z', // Older
    };

    const merged = mergeGuestWithCloud(local, cloud);
    expect(merged.wordSRS['w-1'].repetitions).toBe(3);
    expect(merged.wordSRS['w-1'].interval).toBe(10);
  });

  it('preserves level-scoped progress across HSK 1 and HSK 2', () => {
    const local = createDefaultProgressSnapshotV4();
    local.hskLevelProgress[1].completedLessons = ['hsk1-u1-l1'];

    const cloud = createDefaultProgressSnapshotV4();
    cloud.hskLevelProgress[2].completedLessons = ['hsk2-u1-l1'];

    const merged = mergeGuestWithCloud(local, cloud);
    expect(merged.hskLevelProgress[1].completedLessons).toEqual(['hsk1-u1-l1']);
    expect(merged.hskLevelProgress[2].completedLessons).toEqual(['hsk2-u1-l1']);
  });
});
