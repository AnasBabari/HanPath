import { z } from 'zod';
import type { ProgressSnapshotV4 } from '../types';

export const WordAccuracySchema = z.object({
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  lastSeen: z.number().nonnegative(),
});

export const WordSRSDataSchema = z.object({
  wordId: z.string().min(1),
  interval: z.number().nonnegative(),
  easeFactor: z.number().positive(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repetitions: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export const ProgressSnapshotV4Schema = z.object({
  schemaVersion: z.literal(4),
  hskLevelProgress: z.object({
    1: z.object({
      completedLessons: z.array(z.string()),
    }),
    2: z.object({
      completedLessons: z.array(z.string()),
    }),
  }),
  studyDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(365),
  wordAccuracy: z.record(z.string(), WordAccuracySchema),
  wordSRS: z.record(z.string(), WordSRSDataSchema),
  readStories: z.array(z.string()),
  unlockedAchievements: z.array(z.string()),
  stats: z.object({
    totalXP: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
    totalCorrect: z.number().int().nonnegative(),
    totalAttempted: z.number().int().nonnegative(),
    minutesStudiedToday: z.number().int().nonnegative(),
    dailyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    lastStudyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }),
  preferences: z.object({
    revealPinyin: z.enum(['always', 'peek']),
    targetHskLevel: z.union([z.literal(1), z.literal(2)]),
    dailyGoalMinutes: z.number().int().positive(),
  }),
});

export function createDefaultProgressSnapshotV4(): ProgressSnapshotV4 {
  return {
    schemaVersion: 4,
    hskLevelProgress: {
      1: { completedLessons: [] },
      2: { completedLessons: [] },
    },
    studyDays: [],
    wordAccuracy: {},
    wordSRS: {},
    readStories: [],
    unlockedAchievements: [],
    stats: {
      totalXP: 0,
      longestStreak: 0,
      totalCorrect: 0,
      totalAttempted: 0,
      minutesStudiedToday: 0,
      dailyDate: null,
      lastStudyDate: null,
    },
    preferences: {
      revealPinyin: 'always',
      targetHskLevel: 1,
      dailyGoalMinutes: 15,
    },
  };
}

export function validateProgressSnapshotV4(data: unknown): {
  success: boolean;
  data?: ProgressSnapshotV4;
  error?: string;
} {
  const result = ProgressSnapshotV4Schema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return { success: true, data: result.data as ProgressSnapshotV4 };
}
