/**
 * Gamification — XP, levels, streaks, achievements, daily goals.
 * Sourced from pure UserStats.
 */

import type { UserStats } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';

const DEFAULTS: UserStats = {
  totalXP: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  completedLessons: [],
  wordsLearned: 0,
  totalCorrect: 0,
  totalAttempted: 0,
  lessonsCompletedToday: 0,
  dailyGoalMinutes: 10,
  minutesStudiedToday: 0,
  dailyDate: new Date().toISOString().split('T')[0],
  targetHskLevel: 1,
  studyDays: [],
  lastStudyDate: null,
  lastSessionStart: null,
  unlockedAchievements: [],
  revealPinyin: 'always',
  wordAccuracy: {},
  wordSRS: {},
  xpToday: 0,
  perfectLessonsToday: 0,
  streakExtendedToday: false,
  readStories: [],
};

/* ---- XP / Level math ---- */

export function xpForLevel(lvl: number) {
  return Math.floor(100 * Math.pow(1.15, lvl - 1));
}

export function totalXPForLevel(lvl: number) {
  let s = 0;
  for (let i = 1; i < lvl; i++) s += xpForLevel(i);
  return s;
}

export function levelFromXP(xp: number) {
  let lvl = 1,
    acc = 0;
  while (lvl < 100) {
    const n = xpForLevel(lvl);
    if (acc + n > xp) break;
    acc += n;
    lvl++;
  }
  return lvl;
}

export function xpProgress(xp: number) {
  const lvl = levelFromXP(xp);
  const base = totalXPForLevel(lvl);
  const cur = xp - base,
    need = xpForLevel(lvl);
  return { current: cur, needed: need, percent: Math.min((cur / need) * 100, 100) };
}

/* ---- Streak ---- */

function dateStr(offset = 0) {
  return new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
}

export function bumpStreak(s: UserStats): UserStats {
  const today = dateStr();
  if (s.lastStudyDate === today) return s;

  const yesterday = dateStr(-1);
  const ns = s.lastStudyDate === yesterday ? s.streak + 1 : 1;
  const days = Array.from(new Set([...(s.studyDays || []), today])).slice(-60);

  return {
    ...s,
    streak: ns,
    longestStreak: Math.max(s.longestStreak, ns),
    lastStudyDate: today,
    studyDays: days,
  };
}

/* ---- XP ---- */

export function addXP(s: UserStats, amt: number): UserStats {
  const xp = s.totalXP + amt;
  return { ...s, totalXP: xp, level: levelFromXP(xp) };
}

/* ---- Achievements check ---- */

export function checkNewAchievements(s: UserStats): string[] {
  const unlockedSet = new Set(s.unlockedAchievements || []);
  return ACHIEVEMENTS.reduce<string[]>((newIds, a) => {
    if (!unlockedSet.has(a.id) && a.check(s)) {
      newIds.push(a.id);
    }
    return newIds;
  }, []);
}

export function loadStats(): UserStats {
  return { ...DEFAULTS };
}

export function resetAll() {
  localStorage.removeItem('hanpath:guest:progress_v4');
}
