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
  | 'sentence-build';

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
  nextReviewDate: string;
  repetitions: number;
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
  completedLessons: string[];
  wordsLearned: number;
  totalCorrect: number;
  totalAttempted: number;
  lessonsCompletedToday: number;
  dailyGoalMinutes: number;
  minutesStudiedToday: number;
  lastStudyDate: string | null;
  lastSessionStart: number | null;
  unlockedAchievements: string[];
  revealPinyin: 'always' | 'peek';
  wordAccuracy: Record<string, WordAccuracy>;
  wordSRS: Record<string, WordSRSData>;
  geminiApiKey: string | null;
  // Intentionally preserving for quests logic later
  xpToday: number;
  perfectLessonsToday: number;
  streakExtendedToday: boolean;
  geminiCallsToday: number;
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
  content: string; // Raw text (can be JSON if parsed by UI)
}
