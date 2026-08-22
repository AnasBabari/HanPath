import { z } from 'zod';
import type { ProgressSnapshotV4 } from '../types';

export const WordAccuracySchema = z.object({
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  lastSeen: z.number().nonnegative(),
}).strict();

export const WordSRSDataSchema = z.object({
  wordId: z.string().min(1).max(100),
  interval: z.number().nonnegative(),
  easeFactor: z.number().positive(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repetitions: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
}).strict();

export const ProgressSnapshotV4Schema = z.object({
  schemaVersion: z.literal(4),
  hskLevelProgress: z.object({
    1: z.object({
      completedLessons: z.array(z.string().max(100)).max(500),
    }).strict(),
    2: z.object({
      completedLessons: z.array(z.string().max(100)).max(500),
    }).strict(),
  }).strict(),
  studyDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(3650),
  wordAccuracy: z.record(z.string().max(100), WordAccuracySchema).refine(
    (rec) => Object.keys(rec).length <= 10000,
    { message: 'wordAccuracy exceeds maximum limit of 10000 entries' }
  ),
  wordSRS: z.record(z.string().max(100), WordSRSDataSchema).refine(
    (rec) => Object.keys(rec).length <= 10000,
    { message: 'wordSRS exceeds maximum limit of 10000 entries' }
  ),
  readStories: z.array(z.string().max(100)).max(500),
  unlockedAchievements: z.array(z.string().max(100)).max(100),
  stats: z.object({
    totalXP: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
    totalCorrect: z.number().int().nonnegative(),
    totalAttempted: z.number().int().nonnegative(),
    minutesStudiedToday: z.number().int().nonnegative(),
    dailyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    lastStudyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }).strict(),
  preferences: z.object({
    revealPinyin: z.enum(['always', 'peek']),
    targetHskLevel: z.union([z.literal(1), z.literal(2)]),
    dailyGoalMinutes: z.number().int().min(1).max(180),
  }).strict(),
}).strict();

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
