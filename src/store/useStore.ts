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
  chatHistory: { role: 'user' | 'model'; content: string }[];
  
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
        { role: 'model', content: "你好(nǐ hǎo)！I'm your AI Language Buddy. What would you like to practice today?" }
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
      addChatMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),
      clearChatHistory: () => set({ chatHistory: [] }),

      completeLesson: (lessonId, correct, total, flatVocab) => set((state) => {
        let ns = { ...state.stats };
        if (!ns.completedLessons.includes(lessonId)) {
          ns.completedLessons = [...ns.completedLessons, lessonId];
          ns.lessonsCompletedToday++;
          ns.wordsLearned = new Set(
            flatVocab.filter(l => ns.completedLessons.includes(l.id)).flatMap(l => l.vocab.map((v) => v.id))
          ).size;
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
      name: 'hanpath-progress-v3', // New version for Zustand persistence
      partialize: (state) => ({ 
        stats: state.stats, 
        hskLevel: state.hskLevel,
        chatHistory: state.chatHistory 
      }), // Persist stats, level, and chat history
    }
  )
);
