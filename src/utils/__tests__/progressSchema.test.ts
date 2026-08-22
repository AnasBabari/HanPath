import { describe, it, expect } from 'vitest';
import {
  createDefaultProgressSnapshotV4,
  validateProgressSnapshotV4,
  ProgressSnapshotV4Schema,
} from '../progressSchema';

describe('Progress Snapshot V4 Schema & Validation', () => {
  it('creates and validates a default valid ProgressSnapshotV4', () => {
    const def = createDefaultProgressSnapshotV4();
    expect(def.schemaVersion).toBe(4);
    expect(def.preferences.targetHskLevel).toBe(1);

    const validation = validateProgressSnapshotV4(def);
    expect(validation.success).toBe(true);
    expect(validation.data).toBeDefined();
    expect(validation.error).toBeUndefined();
  });

  it('validates a complete snapshot with valid SRS and accuracy records', () => {
    const fullSnapshot = {
      schemaVersion: 4,
      hskLevelProgress: {
        1: { completedLessons: ['hsk1-u1-l1', 'hsk1-u1-l2'] },
        2: { completedLessons: ['hsk2-u1-l1'] },
      },
      studyDays: ['2026-08-20', '2026-08-21', '2026-08-22'],
      wordAccuracy: {
        'hsk1-1': { correct: 5, total: 6, lastSeen: Date.now() },
      },
      wordSRS: {
        'hsk1-1': {
          wordId: 'hsk1-1',
          interval: 3,
          easeFactor: 2.5,
          nextReviewDate: '2026-08-25',
          repetitions: 2,
          updatedAt: new Date().toISOString(),
        },
      },
      readStories: ['story-1'],
      unlockedAchievements: ['first_lesson'],
      stats: {
        totalXP: 120,
        longestStreak: 3,
        totalCorrect: 25,
        totalAttempted: 30,
        minutesStudiedToday: 15,
        dailyDate: '2026-08-22',
        lastStudyDate: '2026-08-22',
      },
      preferences: {
        revealPinyin: 'always' as const,
        targetHskLevel: 2 as const,
        dailyGoalMinutes: 30,
      },
    };

    const res = validateProgressSnapshotV4(fullSnapshot);
    expect(res.success).toBe(true);
    expect(res.data?.stats.totalXP).toBe(120);
  });

  it('rejects snapshots with unknown top-level fields (strict enforcement)', () => {
    const def = createDefaultProgressSnapshotV4();
    const malicious = {
      ...def,
      injectedAdminField: true,
    };

    const res = validateProgressSnapshotV4(malicious);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('rejects invalid schema version', () => {
    const def = createDefaultProgressSnapshotV4();
    const legacy = {
      ...def,
      schemaVersion: 3,
    };

    const res = validateProgressSnapshotV4(legacy);
    expect(res.success).toBe(false);
  });

  it('rejects invalid date formats', () => {
    const def = createDefaultProgressSnapshotV4();
    const invalidDate = {
      ...def,
      studyDays: ['invalid-date-format'],
    };

    const res = validateProgressSnapshotV4(invalidDate);
    expect(res.success).toBe(false);
  });

  it('rejects invalid preferences and out-of-range dailyGoalMinutes', () => {
    const def = createDefaultProgressSnapshotV4();
    const invalidGoal = {
      ...def,
      preferences: {
        ...def.preferences,
        dailyGoalMinutes: 500, // max is 180
      },
    };

    expect(validateProgressSnapshotV4(invalidGoal).success).toBe(false);

    const negativeGoal = {
      ...def,
      preferences: {
        ...def.preferences,
        dailyGoalMinutes: 0,
      },
    };

    expect(validateProgressSnapshotV4(negativeGoal).success).toBe(false);
  });
});
