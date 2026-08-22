import { create } from 'zustand';
import type { Unit, UserStats, Lesson, ProgressSnapshotV4 } from '../types';
import { addXP as calcAddXP } from '../utils/gamification';
import { updateSRS } from '../utils/srs';
import { createDefaultProgressSnapshotV4, validateProgressSnapshotV4 } from '../utils/progressSchema';
import { mergeGuestWithCloud, calculateStreakFromStudyDays } from '../utils/progressMerge';
import { fetchCloudProgress, syncCloudProgress, deleteCloudAccount } from '../utils/cloudProgress';
import { getSupabaseClientAsync } from '../utils/supabase';

const GUEST_STORAGE_KEY = 'hanpath:guest:progress_v4';
const getUserStorageKey = (userId: string) => `hanpath:user:${userId}:progress_v4`;

function loadSnapshotFromStorage(key: string): ProgressSnapshotV4 {
  try {
    const raw = localStorage.getItem(key);
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

function saveSnapshotToStorage(key: string, snapshot: ProgressSnapshotV4): void {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot));
  } catch (err) {
    console.warn(`Failed to save snapshot to ${key}:`, err);
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error' | 'offline';

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  user: AuthUser | null;
  token: string | null;
}

interface AppState {
  // Authentication & Cloud Sync
  authSession: AuthSession;
  syncStatus: SyncStatus;
  cloudVersion: number;
  lastSyncTime: string | null;
  lastSuccessfulSyncTime: string | null;
  lastSyncAttemptTime: string | null;
  isDirty: boolean;

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

  // Auth & Cloud Sync Actions
  initAuthSession: () => Promise<void>;
  requestEmailOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  resendEmailOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  performSync: () => Promise<void>;
  exportProgressJSON: () => string;
  importProgressJSON: (jsonStr: string) => { success: boolean; error?: string };
}

export function deriveUserStats(snapshot: ProgressSnapshotV4, currentHskLevel: 1 | 2): UserStats {
  const levelProgress = snapshot.hskLevelProgress[currentHskLevel] || { completedLessons: [] };
  const completedLessons = levelProgress.completedLessons || [];

  // Derive unique words learned from all active SRS words and unique completed lesson counts
  const wordsLearned = Object.keys(snapshot.wordSRS).length;

  const now = new Date();
  const { currentStreak, longestStreak } = calculateStreakFromStudyDays(snapshot.studyDays || [], now);

  const xp = snapshot.stats.totalXP || 0;
  // Calculate level based on XP (Level 1 + sqrt(xp / 50))
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

const initialSnapshot = loadSnapshotFromStorage(GUEST_STORAGE_KEY);

export const useStore = create<AppState>((set, get) => ({
  authSession: { user: null, token: null },
  syncStatus: 'idle',
  cloudVersion: 0,
  lastSyncTime: null,
  lastSuccessfulSyncTime: null,
  lastSyncAttemptTime: null,
  isDirty: false,

  snapshot: initialSnapshot,
  hskLevel: initialSnapshot.preferences.targetHskLevel || 1,
  units: null,
  loading: false,
  isFullScreen: false,
  error: null,
  toast: null,
  adminMode: false,
  chatHistory: [
    {
      id: 'init-msg-1',
      role: 'model',
      content: "你好(nǐ hǎo)！I'm your AI Language Tutor. What would you like to practice today?",
    },
  ],

  stats: deriveUserStats(initialSnapshot, initialSnapshot.preferences.targetHskLevel || 1),

  setHSKLevel: (level: number) => {
    const validLevel: 1 | 2 = level === 2 ? 2 : 1;
    set((state) => {
      const updatedSnapshot: ProgressSnapshotV4 = {
        ...state.snapshot,
        preferences: {
          ...state.snapshot.preferences,
          targetHskLevel: validLevel,
        },
      };
      const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
      saveSnapshotToStorage(activeKey, updatedSnapshot);

      return {
        hskLevel: validLevel,
        snapshot: updatedSnapshot,
        units: null, // trigger reload for new level
        stats: deriveUserStats(updatedSnapshot, validLevel),
        isDirty: true,
      };
    });
    get().performSync();
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

  clearChatHistory: () => set({ chatHistory: [] }),

  completeLesson: (lessonId, correct, total = 10) => {
    const state = get();
    const currentHsk = state.hskLevel;
    const todayStr = new Date().toISOString().split('T')[0];

    const currentLessons = state.snapshot.hskLevelProgress[currentHsk]?.completedLessons || [];
    const isNewLesson = !currentLessons.includes(lessonId);
    const updatedLessons = isNewLesson ? [...currentLessons, lessonId] : currentLessons;

    const xpEarned = correct * 10 + 25;
    const studyDays = Array.from(new Set([...(state.snapshot.studyDays || []), todayStr])).slice(-365);

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      hskLevelProgress: {
        ...state.snapshot.hskLevelProgress,
        [currentHsk]: { completedLessons: updatedLessons },
      },
      studyDays,
      stats: {
        ...state.snapshot.stats,
        totalXP: (state.snapshot.stats.totalXP || 0) + xpEarned,
        totalCorrect: (state.snapshot.stats.totalCorrect || 0) + correct,
        totalAttempted: (state.snapshot.stats.totalAttempted || 0) + total,
        minutesStudiedToday: (state.snapshot.stats.minutesStudiedToday || 0) + 3,
        dailyDate: todayStr,
        lastStudyDate: todayStr,
      },
    };

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, currentHsk),
      isDirty: true,
    });

    get().performSync();
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

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });
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

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });
  },

  addXP: (amt) => {
    const state = get();
    const currentStats = deriveUserStats(state.snapshot, state.hskLevel);
    const updatedStats = calcAddXP(currentStats, amt);

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      stats: {
        ...state.snapshot.stats,
        totalXP: updatedStats.totalXP,
      },
    };

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });
  },

  unlockAchievement: (id) => {
    const state = get();
    if (state.snapshot.unlockedAchievements.includes(id)) return;

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      unlockedAchievements: [...state.snapshot.unlockedAchievements, id],
    };

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });
  },

  markStoryRead: (storyId) => {
    const state = get();
    if (state.snapshot.readStories.includes(storyId)) return;

    const updatedSnapshot: ProgressSnapshotV4 = {
      ...state.snapshot,
      readStories: [...state.snapshot.readStories, storyId],
    };

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });

    get().performSync();
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

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });

    get().performSync();
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

    const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
    saveSnapshotToStorage(activeKey, updatedSnapshot);

    set({
      snapshot: updatedSnapshot,
      stats: deriveUserStats(updatedSnapshot, state.hskLevel),
      isDirty: true,
    });

    get().performSync();
  },

  // Auth & Cloud Sync Implementation
  initAuthSession: async () => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id && session.access_token) {
        const user: AuthUser = { id: session.user.id, email: session.user.email };
        const token = session.access_token;
        const userKey = getUserStorageKey(user.id);

        let activeSnapshot = loadSnapshotFromStorage(userKey);

        // Fetch cloud progress and merge
        try {
          const cloudEnv = await fetchCloudProgress(token);
          if (cloudEnv) {
            activeSnapshot = mergeGuestWithCloud(activeSnapshot, cloudEnv.snapshot, false);
            saveSnapshotToStorage(userKey, activeSnapshot);
            set({ cloudVersion: cloudEnv.version });
          } else {
            // First time link: push local snapshot to cloud
            const guestSnap = loadSnapshotFromStorage(GUEST_STORAGE_KEY);
            const merged = mergeGuestWithCloud(guestSnap, null, true);
            activeSnapshot = merged;
            saveSnapshotToStorage(userKey, activeSnapshot);
            const syncRes = await syncCloudProgress(token, activeSnapshot, 0);
            if (syncRes.success && syncRes.envelope) {
              set({ cloudVersion: syncRes.envelope.version });
            }
          }
        } catch (syncErr) {
          console.warn('Initial cloud sync error:', syncErr);
        }

        set({
          authSession: { user, token },
          snapshot: activeSnapshot,
          hskLevel: activeSnapshot.preferences.targetHskLevel || 1,
          stats: deriveUserStats(activeSnapshot, activeSnapshot.preferences.targetHskLevel || 1),
          syncStatus: 'synced',
          lastSyncTime: new Date().toLocaleTimeString(),
        });
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (event === 'SIGNED_IN' && newSession?.user?.id && newSession.access_token) {
          const user: AuthUser = { id: newSession.user.id, email: newSession.user.email };
          const token = newSession.access_token;
          const userKey = getUserStorageKey(user.id);

          const guestSnap = loadSnapshotFromStorage(GUEST_STORAGE_KEY);
          let userSnap = loadSnapshotFromStorage(userKey);

          try {
            const cloudEnv = await fetchCloudProgress(token);
            const merged = mergeGuestWithCloud(guestSnap, cloudEnv ? cloudEnv.snapshot : userSnap, true);
            userSnap = merged;
            saveSnapshotToStorage(userKey, userSnap);

            const pushRes = await syncCloudProgress(token, userSnap, cloudEnv ? cloudEnv.version : 0);
            const newVersion = pushRes.envelope ? pushRes.envelope.version : 1;

            set({
              authSession: { user, token },
              snapshot: userSnap,
              hskLevel: userSnap.preferences.targetHskLevel || 1,
              stats: deriveUserStats(userSnap, userSnap.preferences.targetHskLevel || 1),
              cloudVersion: newVersion,
              syncStatus: 'synced',
              lastSyncTime: new Date().toLocaleTimeString(),
            });
          } catch {
            set({
              authSession: { user, token },
              snapshot: userSnap,
              stats: deriveUserStats(userSnap, userSnap.preferences.targetHskLevel || 1),
            });
          }
        } else if (event === 'SIGNED_OUT') {
          const guestSnap = loadSnapshotFromStorage(GUEST_STORAGE_KEY);
          set({
            authSession: { user: null, token: null },
            snapshot: guestSnap,
            hskLevel: guestSnap.preferences.targetHskLevel || 1,
            stats: deriveUserStats(guestSnap, guestSnap.preferences.targetHskLevel || 1),
            syncStatus: 'idle',
            cloudVersion: 0,
          });
        }
      });
    } catch (err) {
      console.warn('initAuthSession error:', err);
    }
  },

  requestEmailOtp: async (email: string) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { success: false, error: 'Supabase authentication service unavailable' };

    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  verifyEmailOtp: async (email: string, token: string) => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { success: false, error: 'Supabase authentication service unavailable' };

    const cleanToken = token.trim().replace(/\D/g, '');
    if (cleanToken.length !== 6) {
      return { success: false, error: 'Verification code must be exactly 6 digits' };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: cleanToken,
      type: 'email',
    });

    if (error || !data.session || !data.user) {
      return { success: false, error: error?.message || 'Invalid or expired verification code' };
    }

    await get().initAuthSession();
    return { success: true };
  },

  resendEmailOtp: async (email: string) => {
    return get().requestEmailOtp(email);
  },

  signInWithOtp: async (email: string) => {
    return get().requestEmailOtp(email);
  },

  signInWithGoogle: async () => {
    const supabase = await getSupabaseClientAsync();
    if (!supabase) return { success: false, error: 'Supabase authentication service unavailable' };

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  signOut: async () => {
    const supabase = await getSupabaseClientAsync();
    if (supabase) {
      await supabase.auth.signOut();
    }
    const guestSnap = loadSnapshotFromStorage(GUEST_STORAGE_KEY);
    set({
      authSession: { user: null, token: null },
      snapshot: guestSnap,
      hskLevel: guestSnap.preferences.targetHskLevel || 1,
      stats: deriveUserStats(guestSnap, guestSnap.preferences.targetHskLevel || 1),
      syncStatus: 'idle',
      cloudVersion: 0,
      lastSyncTime: null,
      lastSuccessfulSyncTime: null,
      lastSyncAttemptTime: null,
    });
  },

  deleteAccount: async () => {
    const state = get();
    const token = state.authSession.token;
    const userId = state.authSession.user?.id;

    if (!token || !userId) {
      return { success: false, error: 'Not authenticated' };
    }

    const res = await deleteCloudAccount(token);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    try {
      localStorage.removeItem(getUserStorageKey(userId));
    } catch {
      // Ignored
    }

    const guestSnap = createDefaultProgressSnapshotV4();
    saveSnapshotToStorage(GUEST_STORAGE_KEY, guestSnap);

    const supabase = await getSupabaseClientAsync();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    set({
      authSession: { user: null, token: null },
      snapshot: guestSnap,
      hskLevel: 1,
      stats: deriveUserStats(guestSnap, 1),
      syncStatus: 'idle',
      cloudVersion: 0,
      lastSyncTime: null,
      lastSuccessfulSyncTime: null,
      lastSyncAttemptTime: null,
      toast: 'Account and associated data deleted.',
    });

    return { success: true };
  },

  performSync: async () => {
    const state = get();
    const nowIso = new Date().toISOString();
    set({ lastSyncAttemptTime: nowIso });

    if (!navigator.onLine) {
      set({ syncStatus: 'offline' });
      return;
    }

    const token = state.authSession.token;
    if (!token || !state.authSession.user) {
      set({ syncStatus: 'idle' });
      return;
    }

    set({ syncStatus: 'syncing' });
    const result = await syncCloudProgress(token, state.snapshot, state.cloudVersion);

    if (result.success && result.envelope) {
      const updatedSnap = result.mergedSnapshot || result.envelope.snapshot;
      const userKey = getUserStorageKey(state.authSession.user.id);
      saveSnapshotToStorage(userKey, updatedSnap);

      set({
        snapshot: updatedSnap,
        stats: deriveUserStats(updatedSnap, state.hskLevel),
        cloudVersion: result.envelope.version,
        syncStatus: 'synced',
        lastSyncTime: new Date().toLocaleTimeString(),
        lastSuccessfulSyncTime: nowIso,
        isDirty: false,
      });
    } else {
      set({ syncStatus: 'error' });
    }
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
      const state = get();
      const activeKey = state.authSession.user ? getUserStorageKey(state.authSession.user.id) : GUEST_STORAGE_KEY;
      saveSnapshotToStorage(activeKey, imported);

      set({
        snapshot: imported,
        hskLevel: imported.preferences.targetHskLevel || 1,
        stats: deriveUserStats(imported, imported.preferences.targetHskLevel || 1),
        isDirty: true,
      });

      get().performSync();
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to parse JSON file' };
    }
  },
}));
