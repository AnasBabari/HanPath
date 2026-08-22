export interface HSKWord {
  hanzi: string;
  pinyin: string;
  meanings: string[];
  hskLevel: number;
  id: string;
}

export type ExerciseType =
  | 'reading-meaning'
  | 'reading-hanzi'
  | 'listening-select'
  | 'listening-meaning'
  | 'pinyin-type'
  | 'compose'
  | 'sentence-build'
  | 'stroke-order';

export interface VocabCard {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  hskLevel: number;
}

export interface Exercise {
  id: string;
  wordId?: string; // Links back to the VocabCard
  type: ExerciseType;
  prompt: string;
  promptAudio?: string;
  promptPinyin?: string;
  hint?: string;
  options: string[];
  optionsPinyin?: string[];
  answer: string;
  bank?: string[];
}

export interface Lesson {
  id: string;
  unitId: string;
  index: number;
  title: string;
  summary: string;
  vocab: VocabCard[];
  exercises: Exercise[];
}

export interface Unit {
  id: string;
  hskLevel: number;
  index: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface WordAccuracy {
  correct: number;
  total: number;
  lastSeen: number;
}

export interface WordSRSData {
  wordId: string;
  interval: number;
  easeFactor: number;
  nextReviewDate: string; // YYYY-MM-DD
  repetitions: number;
  updatedAt: string;      // ISO 8601 timestamp
}

export interface Quest {
  id: string;
  label: string;
  check: (s: UserStats) => boolean;
  reward: number;
}

export interface UserStats {
  totalXP: number;
  level: number;
  streak: number;
  longestStreak: number;
  completedLessons: string[]; // Current level completed lessons (for backwards-compat/convenience)
  wordsLearned: number;       // Derived from unique completed vocab and active SRS records
  totalCorrect: number;
  totalAttempted: number;
  lessonsCompletedToday: number;
  dailyGoalMinutes: number;
  minutesStudiedToday: number;
  dailyDate: string | null;
  lastStudyDate: string | null;
  lastSessionStart: number | null;
  unlockedAchievements: string[];
  revealPinyin: 'always' | 'peek';
  targetHskLevel: 1 | 2;
  wordAccuracy: Record<string, WordAccuracy>;
  wordSRS: Record<string, WordSRSData>;
  studyDays: string[];
  xpToday: number;
  perfectLessonsToday: number;
  streakExtendedToday: boolean;
  readStories: string[];
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: (s: UserStats) => boolean;
}

export interface Story {
  id: string;
  title: string;
  hskLevel: number;
  content: string; // Chinese text
  pinyin: string; // Corresponding pinyin
  translation: string; // English translation
  xpReward: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

/**
 * Pure client-side learning snapshot schema (v4)
 * Contains zero server metadata (no version or updatedAt)
 */
export interface ProgressSnapshotV4 {
  schemaVersion: 4;
  hskLevelProgress: {
    1: { completedLessons: string[] };
    2: { completedLessons: string[] };
  };
  studyDays: string[]; // ISO YYYY-MM-DD array, bounded to last 365 days
  wordAccuracy: Record<string, WordAccuracy>;
  wordSRS: Record<string, WordSRSData>;
  readStories: string[];
  unlockedAchievements: string[];
  stats: {
    totalXP: number;
    longestStreak: number;
    totalCorrect: number;
    totalAttempted: number;
    minutesStudiedToday: number;
    dailyDate: string | null;
    lastStudyDate: string | null;
  };
  preferences: {
    revealPinyin: 'always' | 'peek';
    targetHskLevel: 1 | 2;
    dailyGoalMinutes: number;
  };
}

/**
 * Server-managed synchronization envelope
 */
export interface SyncEnvelope {
  snapshot: ProgressSnapshotV4;
  version: number;   // Monotonic integer (1, 2, 3...)
  updatedAt: string; // Server timestamp (ISO 8601)
}
