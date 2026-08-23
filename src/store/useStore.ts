import { create } from 'zustand';
import type { Unit, UserStats, Lesson, ProgressSnapshotV4 } from '../types';
import { updateSRS } from '../utils/srs';
import { createDefaultProgressSnapshotV4, validateProgressSnapshotV4 } from '../utils/progressSchema';
import { calculateStreakFromStudyDays } from '../utils/progressMerge';

export const APP_STORAGE_KEY = 'hanpath:progress_v4';
const LEGACY_GUEST_STORAGE_KEY = 'hanpath:guest:progress_v4';

export function loadSnapshotFromStorage(key: string = APP_STORAGE_KEY): ProgressSnapshotV4 {
  try {
    const raw = localStorage.getItem(key) || localStorage.getItem(LEGACY_GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const val = validateProgressSnapshotV4(parsed);
      if (val.success && val.data) {
        return val.data;
      }
    }
  } catch (err) {
    console.warn(`Failed to load snapshot from ${key}:`, err);
  }
  return createDefaultProgressSnapshotV4();
}

export function saveSnapshotToStorage(
  key: string = APP_STORAGE_KEY,
  snapshot: ProgressSnapshotV4
): { success: boolean; error?: string } {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot));
    return { success: true };
  } catch (err) {
    let errorMsg = 'localStorage write failed (quota exceeded or disabled)';
    if (err instanceof Error && err.message) {
      errorMsg = err.message;
    } else if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      if (typeof e.message === 'string' && e.message) {
        errorMsg = e.message;
      } else if (typeof e.name === 'string' && e.name) {
        errorMsg = e.name;
      }
    }
    console.warn(`Failed to save snapshot to ${key}:`, err);
    return { success: false, error: errorMsg };
  }
}

export const INITIAL_CHAT_HISTORY: { id: string; role: 'user' | 'model'; content: string }[] = [
  {
    id: 'init-msg-1',
    role: 'model',
    content: "你好(nǐ hǎo)！I'm your AI Language Tutor. What would you like to practice today?",
  },
];

export interface AppState {
  // Persistence & Storage Health
  storageStatus: 'healthy' | 'error';
  storageError: string | null;

  // Domain State
  snapshot: ProgressSnapshotV4;
  hskLevel: 1 | 2;
  units: Unit[] | null;
  loading: boolean;
  isFullScreen: boolean;
  error: string | null;
  toast: string | null;
  adminMode: boolean;
  chatHistory: { id: string; role: 'user' | 'model'; content: string }[];

  // Derived Accessor
  stats: UserStats;

  // Actions
  setHSKLevel: (level: number) => void;
  setUnits: (units: Unit[] | null) => void;
  setLoading: (loading: boolean) => void;
  setFullScreen: (isFullScreen: boolean) => void;
  setError: (error: string | null) => void;
  setToast: (toast: string | null) => void;
  addChatMessage: (msg: { role: 'user' | 'model'; content: string }) => void;
  clearChatHistory: () => void;

  // Learning Actions
  completeLesson: (lessonId: string, correct: number, total?: number, flatVocab?: Lesson[]) => void;
  updateWordResult: (wordId: string, correct: boolean) => void;
  rateWord: (wordId: string, rating: 'Hard' | 'Good' | 'Easy') => void;
  addXP: (amt: number) => void;
  unlockAchievement: (id: string) => void;
  markStoryRead: (storyId: string) => void;
  setRevealPinyin: (pref: 'always' | 'peek') => void;
  setDailyGoalMinutes: (mins: number) => void;

  // Data Management
  exportProgressJSON: () => string;
  importProgressJSON: (jsonStr: string) => { success: boolean; error?: string };
  resetLocalProgress: () => void;
}

export function deriveUserStats(snapshot: ProgressSnapshotV4, currentHskLevel: 1 | 2): UserStats {
  const levelProgress = snapshot.hskLevelProgress[currentHskLevel] || { completedLessons: [] };
  const completedLessons = levelProgress.completedLessons || [];
  const wordsLearned = Object.keys(snapshot.wordSRS).length;

  const now = new Date();
  const { currentStreak, longestStreak } = calculateStreakFromStudyDays(snapshot.studyDays || [], now);

  const xp = snapshot.stats.totalXP || 0;
  const level = Math.max(1, Math.floor(1 + Math.sqrt(xp / 50)));

  return {
    totalXP: xp,
    level,
    streak: currentStreak,
    longestStreak: Math.max(longestStreak, snapshot.stats.longestStreak || 0),
    completedLessons,
    wordsLearned,
    totalCorrect: snapshot.stats.totalCorrect || 0,
    totalAttempted: snapshot.stats.totalAttempted || 0,
    lessonsCompletedToday: 0,
    dailyGoalMinutes: snapshot.preferences.dailyGoalMinutes || 15,
    minutesStudiedToday: snapshot.stats.minutesStudiedToday || 0,
    dailyDate: snapshot.stats.dailyDate,
    lastStudyDate: snapshot.stats.lastStudyDate,
    lastSessionStart: null,
    unlockedAchievements: snapshot.unlockedAchievements || [],
    revealPinyin: snapshot.preferences.revealPinyin || 'always',
    targetHskLevel: snapshot.preferences.targetHskLevel || 1,
    wordAccuracy: snapshot.wordAccuracy || {},
    wordSRS: snapshot.wordSRS || {},
    studyDays: snapshot.studyDays || [],
    xpToday: 0,
    perfectLessonsToday: 0,
    streakExtendedToday: currentStreak > 0,
    readStories: snapshot.readStories || [],
  };
}

const initialSnapshot = loadSnapshotFromStorage(APP_STORAGE_KEY);

function commitStorageUpdate(
  set: (fn: (state: AppState) => Partial<AppState>) => void,
  updatedSnapshot: ProgressSnapshotV4,
  hskLevel: 1 | 2
): void {
  const saveRes = saveSnapshotToStorage(APP_STORAGE_KEY, updatedSnapshot);
  set(() => ({
    snapshot: updatedSnapshot,
    stats: deriveUserStats(updatedSnapshot, hskLevel),
    storageStatus: saveRes.success ? 'healthy' : 'error',
    storageError: saveRes.success ? null : (saveRes.error || 'Storage write failed'),
  }));
}

export const useStore = create<AppState>((set, get) => ({
  storageStatus: 'healthy',
  storageError: null,

  snapshot: initialSnapshot,
  hskLevel: initialSnapshot.preferences.targetHskLevel || 1,
  units: null,
  loading: false,
  isFullScreen: false,
  error: null,
  toast: null,
  adminMode: false,
  chatHistory: INITIAL_CHAT_HISTORY,

  stats: deriveUserStats(initialSnapshot, initialSnapshot.preferences.targetHskLevel || 1),

  setHSKLevel: (level: number) => {
    const validLevel: 1 | 2 = level === 2 ? 2 : 1;
    const state = get();
    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      preferences: {
        ...state.snapshot.preferences,
        targetHskLevel: validLevel,
      },
    };

    const saveRes = saveSnapshotToStorage(APP_STORAGE_KEY, updatedSnapshot);
    set({
      hskLevel: validLevel,
      snapshot: updatedSnapshot,
      units: null,
      stats: deriveUserStats(updatedSnapshot, validLevel),
      storageStatus: saveRes.success ? 'healthy' : 'error',
      storageError: saveRes.success ? null : (saveRes.error || 'Storage write failed'),
    });
  },

  setUnits: (units) => set({ units }),
  setLoading: (loading) => set({ loading }),
  setFullScreen: (isFullScreen) => set({ isFullScreen }),
  setError: (error) => set({ error }),
  setToast: (toast) => set({ toast }),

  addChatMessage: (msg) =>
    set((state) => ({
      chatHistory: [
        ...state.chatHistory,
        { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ],
    })),

  clearChatHistory: () => set({ chatHistory: INITIAL_CHAT_HISTORY }),

  completeLesson: (lessonId, correct, total = 10, flatLessons = []) => {
    const state = get();
    const currentHsk = state.hskLevel;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const completedLesson = flatLessons.find((lesson) => lesson.id === lessonId);
    const seededWordSRS = { ...state.snapshot.wordSRS };

    for (const word of completedLesson?.vocab || []) {
      if (!seededWordSRS[word.id]) {
        seededWordSRS[word.id] = {
          wordId: word.id,
          easeFactor: 2.5,
          interval: 0,
          repetitions: 0,
          nextReviewDate: todayStr,
          updatedAt: now.toISOString(),
        };
      }
    }

    const currentLessons = state.snapshot.hskLevelProgress[currentHsk]?.completedLessons || [];
    const isNewLesson = !currentLessons.includes(lessonId);
    const updatedCompleted = isNewLesson ? [...currentLessons, lessonId] : currentLessons;

    const baseXP = correct * 10;
    const bonusXP = isNewLesson ? 50 : 10;
    const xpGained = baseXP + bonusXP;
    const updatedXP = (state.snapshot.stats.totalXP || 0) + xpGained;

    const studyDays = state.snapshot.studyDays || [];
    const updatedStudyDays = studyDays.includes(todayStr) ? studyDays : [...studyDays, todayStr];

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      hskLevelProgress: {
        ...state.snapshot.hskLevelProgress,
        [currentHsk]: {
          completedLessons: updatedCompleted,
        },
      },
      stats: {
        ...state.snapshot.stats,
        totalXP: updatedXP,
        totalCorrect: (state.snapshot.stats.totalCorrect || 0) + correct,
        totalAttempted: (state.snapshot.stats.totalAttempted || 0) + total,
      },
      wordSRS: seededWordSRS,
      studyDays: updatedStudyDays,
    };

    commitStorageUpdate(set, updatedSnapshot, currentHsk);
  },

  updateWordResult: (wordId, correct) => {
    const state = get();
    const prev = state.snapshot.wordAccuracy[wordId] || { correct: 0, total: 0, lastSeen: 0 };
    const updatedAccuracy = {
      ...state.snapshot.wordAccuracy,
      [wordId]: {
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
        lastSeen: Date.now(),
      },
    };

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      wordAccuracy: updatedAccuracy,
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  rateWord: (wordId, rating) => {
    const state = get();
    const qualityMap = { Hard: 2, Good: 4, Easy: 5 } as const;
    const quality = qualityMap[rating];

    const currentSRS = state.snapshot.wordSRS[wordId];
    const updatedSRS = updateSRS(currentSRS, wordId, quality);

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      wordSRS: {
        ...state.snapshot.wordSRS,
        [wordId]: updatedSRS,
      },
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  addXP: (amt) => {
    const state = get();
    const updatedXP = (state.snapshot.stats.totalXP || 0) + amt;

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      stats: {
        ...state.snapshot.stats,
        totalXP: updatedXP,
      },
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  unlockAchievement: (id) => {
    const state = get();
    if (state.snapshot.unlockedAchievements.includes(id)) return;

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      unlockedAchievements: [...state.snapshot.unlockedAchievements, id],
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  markStoryRead: (storyId) => {
    const state = get();
    if (state.snapshot.readStories.includes(storyId)) return;

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      readStories: [...state.snapshot.readStories, storyId],
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  setRevealPinyin: (pref) => {
    const state = get();
    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      preferences: {
        ...state.snapshot.preferences,
        revealPinyin: pref,
      },
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  setDailyGoalMinutes: (mins) => {
    const state = get();
    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      preferences: {
        ...state.snapshot.preferences,
        dailyGoalMinutes: mins,
      },
    };

    commitStorageUpdate(set, updatedSnapshot, state.hskLevel);
  },

  exportProgressJSON: () => {
    const state = get();
    return JSON.stringify(state.snapshot, null, 2);
  },

  importProgressJSON: (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const val = validateProgressSnapshotV4(parsed);
      if (!val.success || !val.data) {
        return { success: false, error: val.error || 'Invalid JSON progress schema' };
      }

      const imported = val.data;
      const targetLevel = imported.preferences.targetHskLevel || 1;
      const saveRes = saveSnapshotToStorage(APP_STORAGE_KEY, imported);

      set({
        snapshot: imported,
        hskLevel: targetLevel,
        stats: deriveUserStats(imported, targetLevel),
        storageStatus: saveRes.success ? 'healthy' : 'error',
        storageError: saveRes.success ? null : (saveRes.error || 'Storage write failed'),
      });

      return { success: true };
    } catch {
      return { success: false, error: 'Failed to parse JSON file' };
    }
  },

  resetLocalProgress: () => {
    try {
      localStorage.removeItem(APP_STORAGE_KEY);
      localStorage.removeItem(LEGACY_GUEST_STORAGE_KEY);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('hanpath:user:') || key.startsWith('hanpath:guest:'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn('Failed to clear localStorage keys during reset:', err);
    }

    const init = createDefaultProgressSnapshotV4();
    const saveRes = saveSnapshotToStorage(APP_STORAGE_KEY, init);

    set({
      snapshot: init,
      hskLevel: 1,
      stats: deriveUserStats(init, 1),
      chatHistory: INITIAL_CHAT_HISTORY,
      storageStatus: saveRes.success ? 'healthy' : 'error',
      storageError: saveRes.success ? null : (saveRes.error || 'Storage write failed'),
    });
  },
}));
