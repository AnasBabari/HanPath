import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import type { Unit, UserStats, LeaderboardEntry, Lesson } from '../types';
import { loadStats, addXP, bumpStreak } from '../utils/gamification';
import { updateSRS } from '../utils/srs';

/* ---- Zod Schemas for Runtime Validation ---- */

const WordAccuracySchema = z.object({
  correct: z.number(),
  total: z.number(),
  lastSeen: z.number(),
});

const WordSRSDataSchema = z.object({
  wordId: z.string(),
  interval: z.number(),
  easeFactor: z.number(),
  nextReviewDate: z.string(),
  repetitions: z.number(),
});

const UserStatsSchema = z.object({
  totalXP: z.number(),
  level: z.number(),
  streak: z.number(),
  longestStreak: z.number(),
  completedLessons: z.array(z.string()),
  wordsLearned: z.number(),
  totalCorrect: z.number(),
  totalAttempted: z.number(),
  lessonsCompletedToday: z.number(),
  dailyGoalMinutes: z.number(),
  minutesStudiedToday: z.number(),
  lastStudyDate: z.string().nullable(),
  lastSessionStart: z.number().nullable(),
  unlockedAchievements: z.array(z.string()),
  revealPinyin: z.enum(['always', 'peek']),
  wordAccuracy: z.record(z.string(), WordAccuracySchema),
  wordSRS: z.record(z.string(), WordSRSDataSchema),
  xpToday: z.number(),
  perfectLessonsToday: z.number(),
  streakExtendedToday: z.boolean(),
  readStories: z.array(z.string()),
});

/* ---- Zustand Store Interface ---- */

interface AppState {
  stats: UserStats;
  cloudUserId: string | null;
  units: Unit[] | null;
  hskLevel: number;
  leaderboard: LeaderboardEntry[];
  loading: boolean;
  isFullScreen: boolean;
  error: string | null;
  toast: string | null;
  adminMode: boolean;
  chatHistory: { id: string; role: 'user' | 'model'; content: string }[];
  
  /* Actions */
  setStats: (stats: UserStats | ((prev: UserStats) => UserStats)) => void;
  setCloudUserId: (id: string | null) => void;
  setUnits: (units: Unit[] | null) => void;
  setHSKLevel: (level: number) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setFullScreen: (isFullScreen: boolean) => void;
  setError: (error: string | null) => void;
  setToast: (toast: string | null) => void;
  addChatMessage: (msg: { role: 'user' | 'model'; content: string }) => void;
  clearChatHistory: () => void;
  
  /* Business Logic Actions */
  completeLesson: (lessonId: string, correct: number, total: number, flatVocab: Lesson[]) => void;
  updateWordResult: (wordId: string, correct: boolean) => void;
  rateWord: (wordId: string, rating: 'Hard' | 'Good' | 'Easy') => void;
  addXP: (amt: number) => void;
  unlockAchievement: (id: string) => void;
  resetProgress: (newStats: UserStats) => void;
  markStoryRead: (storyId: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      stats: loadStats(), // Initial load from existing utility
      cloudUserId: null,
      units: null,
      hskLevel: 1,
      leaderboard: [],
      loading: true,
      isFullScreen: false,
      error: null,
      toast: null,
      adminMode: false,
      chatHistory: [
        { id: 'init-msg-1', role: 'model', content: "你好(nǐ hǎo)！I'm your AI Language Buddy. What would you like to practice today?" }
      ],

      setStats: (updater) => set((state) => ({
        stats: typeof updater === 'function' ? updater(state.stats) : updater
      })),
      setCloudUserId: (id) => set({ cloudUserId: id }),
      setUnits: (units) => set({ units }),
      setHSKLevel: (hskLevel) => set((state) => ({ 
        hskLevel, 
        units: null,
        stats: { ...state.stats, completedLessons: [] } // Reset progress when switching HSK level
      })),
      setLeaderboard: (leaderboard) => set({ leaderboard }),
      setLoading: (loading) => set({ loading }),
      setFullScreen: (isFullScreen) => set({ isFullScreen }),
      setError: (error) => set({ error }),
      setToast: (toast) => set({ toast }),
      addChatMessage: (msg) => set((state) => ({
        chatHistory: [...state.chatHistory, { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]
      })),
      clearChatHistory: () => set({ chatHistory: [] }),

      completeLesson: (lessonId, correct, total, flatVocab) => set((state) => {
        let ns = { ...state.stats };
        if (!ns.completedLessons.includes(lessonId)) {
          ns.completedLessons = [...ns.completedLessons, lessonId];
          ns.lessonsCompletedToday++;
          const completedSet = new Set(ns.completedLessons);
          const learnedIds = new Set<string>();
          for (const l of flatVocab) {
            if (completedSet.has(l.id)) {
              for (const v of l.vocab) learnedIds.add(v.id);
            }
          }
          ns.wordsLearned = learnedIds.size;
        }
        ns.totalCorrect += correct;
        ns.totalAttempted += total;
        
        if (correct === total) ns.perfectLessonsToday++;
        
        const xpEarned = correct * 10 + 25;
        ns.xpToday += xpEarned;
        ns = addXP(ns, xpEarned);
        ns = bumpStreak(ns);

        const parseResult = UserStatsSchema.safeParse(ns);
        if (!parseResult.success) {
          console.error('UserStats validation failed in completeLesson, state rolled back:', parseResult.error);
          return state; // Rollback
        }
        return { stats: ns };
      }),

      updateWordResult: (wordId, correct) => set((state) => {
        const prev = state.stats.wordAccuracy[wordId] ?? { correct: 0, total: 0, lastSeen: 0 };
        const updatedStats = {
          ...state.stats,
          wordAccuracy: {
            ...state.stats.wordAccuracy,
            [wordId]: {
              correct: prev.correct + (correct ? 1 : 0),
              total: prev.total + 1,
              lastSeen: Date.now(),
            },
          },
        };
        // Runtime validation
        const parseResult = UserStatsSchema.safeParse(updatedStats);
        if (!parseResult.success) {
          console.error('UserStats validation failed in updateWordResult, state rolled back:', parseResult.error);
          return state;
        }
        return { stats: updatedStats };
      }),

      rateWord: (wordId, rating) => set((state) => {
        const qualityMap = { 'Hard': 2, 'Good': 4, 'Easy': 5 } as const;
        const quality = qualityMap[rating];
        
        const currentSRS = state.stats.wordSRS[wordId];
        const updatedSRS = updateSRS(currentSRS, wordId, quality);

        const updatedStats = {
          ...state.stats,
          wordSRS: {
            ...state.stats.wordSRS,
            [wordId]: updatedSRS,
          },
        };

        // Runtime validation
        const parseResult = UserStatsSchema.safeParse(updatedStats);
        if (!parseResult.success) {
          console.error('UserStats validation failed in rateWord, state rolled back:', parseResult.error);
          return state;
        }
        return { stats: updatedStats };
      }),

      addXP: (amt) => set((state) => {
        const updatedStats = { ...state.stats, totalXP: state.stats.totalXP + amt };
        return { stats: updatedStats };
      }),

      unlockAchievement: (id) => set((state) => ({
        stats: {
          ...state.stats,
          unlockedAchievements: [...state.stats.unlockedAchievements, id]
        }
      })),

      resetProgress: (newStats) => set({ stats: newStats, cloudUserId: null }),
      
      markStoryRead: (storyId) => set((state) => {
        if (state.stats.readStories.includes(storyId)) return {};
        return {
          stats: {
            ...state.stats,
            readStories: [...state.stats.readStories, storyId]
          }
        };
      }),
    }),
    {
      name: 'hanpath-progress-v3',
      version: 3,
      migrate: (persistedState: unknown) => {
        const defaultState = {
          stats: loadStats(),
          hskLevel: 1,
          chatHistory: [
            { id: 'init-msg-1', role: 'model' as const, content: "你好(nǐ hǎo)！I'm your AI Language Buddy. What would you like to practice today?" }
          ],
        };

        if (!persistedState || typeof persistedState !== 'object') {
          return defaultState;
        }

        const raw = persistedState as Record<string, unknown>;
        const rawStats = (raw.stats && typeof raw.stats === 'object' ? raw.stats : {}) as Record<string, unknown>;

        // Cleanly backfill any missing fields across v1/v2 schema evolutions
        const migratedStats: UserStats = {
          totalXP: typeof rawStats.totalXP === 'number' ? rawStats.totalXP : 0,
          level: typeof rawStats.level === 'number' ? rawStats.level : 1,
          streak: typeof rawStats.streak === 'number' ? rawStats.streak : 0,
          longestStreak: typeof rawStats.longestStreak === 'number' ? rawStats.longestStreak : 0,
          completedLessons: Array.isArray(rawStats.completedLessons) ? rawStats.completedLessons.map(String) : [],
          wordsLearned: typeof rawStats.wordsLearned === 'number' ? rawStats.wordsLearned : 0,
          totalCorrect: typeof rawStats.totalCorrect === 'number' ? rawStats.totalCorrect : 0,
          totalAttempted: typeof rawStats.totalAttempted === 'number' ? rawStats.totalAttempted : 0,
          lessonsCompletedToday: typeof rawStats.lessonsCompletedToday === 'number' ? rawStats.lessonsCompletedToday : 0,
          dailyGoalMinutes: typeof rawStats.dailyGoalMinutes === 'number' ? rawStats.dailyGoalMinutes : 10,
          minutesStudiedToday: typeof rawStats.minutesStudiedToday === 'number' ? rawStats.minutesStudiedToday : 0,
          lastStudyDate: typeof rawStats.lastStudyDate === 'string' ? rawStats.lastStudyDate : null,
          lastSessionStart: typeof rawStats.lastSessionStart === 'number' ? rawStats.lastSessionStart : null,
          unlockedAchievements: Array.isArray(rawStats.unlockedAchievements) ? rawStats.unlockedAchievements.map(String) : [],
          revealPinyin: rawStats.revealPinyin === 'peek' ? 'peek' : 'always',
          wordAccuracy: (rawStats.wordAccuracy && typeof rawStats.wordAccuracy === 'object' ? rawStats.wordAccuracy : {}) as Record<string, { correct: number; total: number; lastSeen: number }>,
          wordSRS: (rawStats.wordSRS && typeof rawStats.wordSRS === 'object' ? rawStats.wordSRS : {}) as Record<string, { wordId: string; interval: number; easeFactor: number; nextReviewDate: string; repetitions: number }>,
          xpToday: typeof rawStats.xpToday === 'number' ? rawStats.xpToday : 0,
          perfectLessonsToday: typeof rawStats.perfectLessonsToday === 'number' ? rawStats.perfectLessonsToday : 0,
          streakExtendedToday: Boolean(rawStats.streakExtendedToday),
          readStories: Array.isArray(rawStats.readStories) ? rawStats.readStories.map(String) : [],
        };

        const validated = UserStatsSchema.safeParse(migratedStats);
        const finalStats = validated.success ? validated.data : defaultState.stats;

        return {
          stats: finalStats,
          hskLevel: typeof raw.hskLevel === 'number' && raw.hskLevel >= 1 && raw.hskLevel <= 6 ? raw.hskLevel : 1,
          chatHistory: Array.isArray(raw.chatHistory) && raw.chatHistory.length > 0 ? (raw.chatHistory as typeof defaultState.chatHistory) : defaultState.chatHistory,
        };
      },
      partialize: (state) => ({ 
        stats: state.stats, 
        hskLevel: state.hskLevel,
        chatHistory: state.chatHistory 
      }),
    }
  )
);
