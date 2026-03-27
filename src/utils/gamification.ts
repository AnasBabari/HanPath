/**
 * Gamification — XP, levels, streaks, achievements, daily goals.
 * NO hearts system — unlimited practice.
 */

import type { UserStats } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';

const STORAGE_KEY = 'hanpath-progress-v2';

const DEFAULTS: UserStats = {
  totalXP: 0, level: 1, streak: 0, longestStreak: 0,
  completedLessons: [], wordsLearned: 0,
  totalCorrect: 0, totalAttempted: 0, lessonsCompletedToday: 0,
  dailyGoalMinutes: 10, minutesStudiedToday: 0,
  lastStudyDate: null, lastSessionStart: null,
  unlockedAchievements: [], revealPinyin: 'always', wordAccuracy: {},
  wordSRS: {}, geminiApiKey: null,
  xpToday: 0, perfectLessonsToday: 0, streakExtendedToday: false
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

/* ---- Achievements extracted to src/data/achievements.ts ---- */

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
