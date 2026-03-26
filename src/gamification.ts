/**
 * Gamification — XP, levels, streaks, achievements, daily goals.
 * NO hearts system — unlimited practice.
 */

const STORAGE_KEY = 'hanpath-progress-v2';

export interface WordAccuracy {
  correct: number;
  total: number;
  lastSeen: number;
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
}

const DEFAULTS: UserStats = {
  totalXP: 0, level: 1, streak: 0, longestStreak: 0,
  completedLessons: [], wordsLearned: 0,
  totalCorrect: 0, totalAttempted: 0, lessonsCompletedToday: 0,
  dailyGoalMinutes: 10, minutesStudiedToday: 0,
  lastStudyDate: null, lastSessionStart: null,
  unlockedAchievements: [], revealPinyin: 'always', wordAccuracy: {},
};

/* ---- XP / Level math ---- */

export function xpForLevel(lvl: number) { return Math.floor(100 * Math.pow(1.15, lvl - 1)); }

export function totalXPForLevel(lvl: number) {
  let s = 0; for (let i = 1; i < lvl; i++) s += xpForLevel(i); return s;
}

export function levelFromXP(xp: number) {
  let lvl = 1, acc = 0;
  while (lvl < 100) { const n = xpForLevel(lvl); if (acc + n > xp) break; acc += n; lvl++; }
  return lvl;
}

export function xpProgress(xp: number) {
  const lvl = levelFromXP(xp);
  const base = totalXPForLevel(lvl);
  const cur = xp - base, need = xpForLevel(lvl);
  return { current: cur, needed: need, percent: Math.min((cur / need) * 100, 100) };
}

/* ---- Achievements ---- */

export interface Achievement {
  id: string; title: string; desc: string; icon: string;
  check: (s: UserStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-lesson', title: 'First Steps', desc: 'Complete your first lesson', icon: '🎯', check: s => s.completedLessons.length >= 1 },
  { id: 'five-lessons', title: 'Getting Started', desc: 'Complete 5 lessons', icon: '📚', check: s => s.completedLessons.length >= 5 },
  { id: 'ten-lessons', title: 'Dedicated Learner', desc: 'Complete 10 lessons', icon: '🌟', check: s => s.completedLessons.length >= 10 },
  { id: 'twenty-lessons', title: 'Rising Scholar', desc: 'Complete 20 lessons', icon: '🏆', check: s => s.completedLessons.length >= 20 },
  { id: 'fifty-lessons', title: 'Knowledge Seeker', desc: 'Complete 50 lessons', icon: '👑', check: s => s.completedLessons.length >= 50 },
  { id: 'streak-3', title: 'Warming Up', desc: '3-day streak', icon: '🔥', check: s => s.streak >= 3 },
  { id: 'streak-7', title: 'On Fire', desc: '7-day streak', icon: '🔥', check: s => s.streak >= 7 },
  { id: 'streak-30', title: 'Unstoppable', desc: '30-day streak', icon: '💪', check: s => s.streak >= 30 },
  { id: 'streak-100', title: 'Century Streak', desc: '100-day streak', icon: '⚡', check: s => s.streak >= 100 },
  { id: 'xp-500', title: 'XP Hunter', desc: 'Earn 500 XP', icon: '💎', check: s => s.totalXP >= 500 },
  { id: 'xp-1000', title: 'XP Master', desc: 'Earn 1000 XP', icon: '💎', check: s => s.totalXP >= 1000 },
  { id: 'xp-5000', title: 'XP Legend', desc: 'Earn 5000 XP', icon: '🌈', check: s => s.totalXP >= 5000 },
  { id: 'words-50', title: 'Vocab Builder', desc: 'Learn 50 words', icon: '📖', check: s => s.wordsLearned >= 50 },
  { id: 'words-100', title: 'Word Collector', desc: 'Learn 100 words', icon: '📖', check: s => s.wordsLearned >= 100 },
  { id: 'words-500', title: 'Walking Dictionary', desc: 'Learn 500 words', icon: '🧠', check: s => s.wordsLearned >= 500 },
  { id: 'accuracy-90', title: 'Sharp Mind', desc: '90%+ accuracy (50+ Qs)', icon: '🎯', check: s => s.totalAttempted >= 50 && s.totalCorrect / s.totalAttempted >= 0.9 },
  { id: 'level-5', title: 'Level 5', desc: 'Reach level 5', icon: '⭐', check: s => s.level >= 5 },
  { id: 'level-10', title: 'Level 10', desc: 'Reach level 10', icon: '⭐', check: s => s.level >= 10 },
  { id: 'level-25', title: 'Level 25', desc: 'Reach level 25', icon: '🌟', check: s => s.level >= 25 },
];

/* ---- Streak ---- */

function dateStr(offset = 0) { return new Date(Date.now() + offset * 86400000).toDateString(); }

export function bumpStreak(s: UserStats): UserStats {
  const d = dateStr();
  if (s.lastStudyDate === d) return s;
  const ns = s.lastStudyDate === dateStr(-1) ? s.streak + 1 : 1;
  return { ...s, streak: ns, longestStreak: Math.max(s.longestStreak, ns), lastStudyDate: d };
}

/* ---- XP ---- */

export function addXP(s: UserStats, amt: number): UserStats {
  const xp = s.totalXP + amt;
  return { ...s, totalXP: xp, level: levelFromXP(xp) };
}

/* ---- Achievements check ---- */

export function checkNewAchievements(s: UserStats): string[] {
  return ACHIEVEMENTS.filter(a => !s.unlockedAchievements.includes(a.id) && a.check(s)).map(a => a.id);
}

/* ---- Persistence ---- */

export function loadStats(): UserStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    const s: UserStats = { ...DEFAULTS, ...p };
    if (s.lastStudyDate !== dateStr()) { s.lessonsCompletedToday = 0; s.minutesStudiedToday = 0; }
    return s;
  } catch { return { ...DEFAULTS }; }
}

export function saveStats(s: UserStats) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

export function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  for (let i = 1; i <= 7; i++) try { localStorage.removeItem(`hanpath-hsk-v2-${i}`); } catch { /* ok */ }
}
