import type { ProgressSnapshotV4, WordAccuracy, WordSRSData } from '../types';
import { createDefaultProgressSnapshotV4 } from './progressSchema';

/**
 * Calculates current active consecutive daily streak from a sorted list of ISO study days.
 */
export function calculateStreakFromStudyDays(
  studyDays: string[],
  referenceDate: Date = new Date()
): { currentStreak: number; longestStreak: number } {
  if (!studyDays.length) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const uniqueSorted = Array.from(new Set(studyDays)).sort();
  const todayStr = referenceDate.toISOString().split('T')[0];

  const yesterday = new Date(referenceDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let maxStreak = 0;
  let running = 0;
  let prevDateMs: number | null = null;

  for (const dayStr of uniqueSorted) {
    const currentMs = new Date(`${dayStr}T00:00:00Z`).getTime();
    if (prevDateMs === null) {
      running = 1;
    } else {
      const diffDays = Math.round((currentMs - prevDateMs) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        running += 1;
      } else if (diffDays > 1) {
        running = 1;
      }
    }
    prevDateMs = currentMs;
    if (running > maxStreak) {
      maxStreak = running;
    }
  }

  // Check if the streak is currently active (includes today or yesterday)
  const lastDay = uniqueSorted[uniqueSorted.length - 1];
  let currentStreak = 0;
  if (lastDay === todayStr || lastDay === yesterdayStr) {
    // Count backwards from last day
    currentStreak = 1;
    let expectedMs = new Date(`${lastDay}T00:00:00Z`).getTime();
    for (let i = uniqueSorted.length - 2; i >= 0; i--) {
      const prevMs = new Date(`${uniqueSorted[i]}T00:00:00Z`).getTime();
      const diff = Math.round((expectedMs - prevMs) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        currentStreak += 1;
        expectedMs = prevMs;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(maxStreak, currentStreak),
  };
}

/**
 * Idempotently merges local and cloud progress snapshots.
 *
 * Rules:
 * 1. Union completed lessons, read stories, and achievements.
 * 2. Max value for XP, longest streak, total correct/attempted.
 * 3. Union study days (last 365) and recalculate active streak.
 * 4. Accuracy: correct = max(local, cloud), total = max(local, cloud, correct), lastSeen = max.
 * 5. SRS: per-word timestamp resolution (newest updatedAt wins).
 * 6. Daily counters: preserve if date is today.
 * 7. Preferences: local preferences win if localModified is true or on initial merge.
 */
export function mergeGuestWithCloud(
  local: ProgressSnapshotV4 | null,
  cloud: ProgressSnapshotV4 | null,
  preferLocalPreferences: boolean = true
): ProgressSnapshotV4 {
  const base = createDefaultProgressSnapshotV4();
  const l = local || base;
  const c = cloud || base;

  // 1. Lessons per level
  const hsk1Lessons = Array.from(
    new Set([...(l.hskLevelProgress[1]?.completedLessons || []), ...(c.hskLevelProgress[1]?.completedLessons || [])])
  );
  const hsk2Lessons = Array.from(
    new Set([...(l.hskLevelProgress[2]?.completedLessons || []), ...(c.hskLevelProgress[2]?.completedLessons || [])])
  );

  // 2. Stories & Achievements
  const readStories = Array.from(new Set([...(l.readStories || []), ...(c.readStories || [])]));
  const unlockedAchievements = Array.from(
    new Set([...(l.unlockedAchievements || []), ...(c.unlockedAchievements || [])])
  );

  // 3. Study Days & Streak
  const mergedDays = Array.from(new Set([...(l.studyDays || []), ...(c.studyDays || [])]))
    .sort()
    .slice(-365); // Cap at 365 entries

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const { longestStreak } = calculateStreakFromStudyDays(mergedDays, now);

  const totalXP = Math.max(l.stats.totalXP || 0, c.stats.totalXP || 0);
  const totalCorrect = Math.max(l.stats.totalCorrect || 0, c.stats.totalCorrect || 0);
  const totalAttempted = Math.max(l.stats.totalAttempted || 0, c.stats.totalAttempted || 0, totalCorrect);

  let minutesStudiedToday = 0;
  if (l.stats.dailyDate === todayStr && c.stats.dailyDate === todayStr) {
    minutesStudiedToday = Math.max(l.stats.minutesStudiedToday || 0, c.stats.minutesStudiedToday || 0);
  } else if (l.stats.dailyDate === todayStr) {
    minutesStudiedToday = l.stats.minutesStudiedToday || 0;
  } else if (c.stats.dailyDate === todayStr) {
    minutesStudiedToday = c.stats.minutesStudiedToday || 0;
  }

  const lastStudyDate = [l.stats.lastStudyDate, c.stats.lastStudyDate]
    .filter(Boolean)
    .sort()
    .pop() || null;

  // 4. Word Accuracy
  const allWordIds = Array.from(new Set([...Object.keys(l.wordAccuracy || {}), ...Object.keys(c.wordAccuracy || {})]));
  const mergedAccuracy: Record<string, WordAccuracy> = {};

  for (const wordId of allWordIds) {
    const la = l.wordAccuracy[wordId];
    const ca = c.wordAccuracy[wordId];
    const correct = Math.max(la?.correct || 0, ca?.correct || 0);
    const total = Math.max(la?.total || 0, ca?.total || 0, correct);
    const lastSeen = Math.max(la?.lastSeen || 0, ca?.lastSeen || 0);
    mergedAccuracy[wordId] = { correct, total, lastSeen };
  }

  // 5. Word SRS
  const allSRSWordIds = Array.from(new Set([...Object.keys(l.wordSRS || {}), ...Object.keys(c.wordSRS || {})]));
  const mergedSRS: Record<string, WordSRSData> = {};

  for (const wordId of allSRSWordIds) {
    const ls = l.wordSRS[wordId];
    const cs = c.wordSRS[wordId];

    if (ls && !cs) {
      mergedSRS[wordId] = ls;
    } else if (!ls && cs) {
      mergedSRS[wordId] = cs;
    } else if (ls && cs) {
      // Pick newer updatedAt
      const lTime = new Date(ls.updatedAt || 0).getTime();
      const cTime = new Date(cs.updatedAt || 0).getTime();
      mergedSRS[wordId] = lTime >= cTime ? ls : cs;
    }
  }

  // 6. Preferences
  const chosenPref = preferLocalPreferences ? l.preferences : c.preferences;

  return {
    schemaVersion: 4,
    hskLevelProgress: {
      1: { completedLessons: hsk1Lessons },
      2: { completedLessons: hsk2Lessons },
    },
    studyDays: mergedDays,
    wordAccuracy: mergedAccuracy,
    wordSRS: mergedSRS,
    readStories,
    unlockedAchievements,
    stats: {
      totalXP,
      longestStreak: Math.max(longestStreak, l.stats.longestStreak || 0, c.stats.longestStreak || 0),
      totalCorrect,
      totalAttempted,
      minutesStudiedToday,
      dailyDate: minutesStudiedToday > 0 ? todayStr : null,
      lastStudyDate,
    },
    preferences: {
      revealPinyin: chosenPref.revealPinyin || 'always',
      targetHskLevel: chosenPref.targetHskLevel === 2 ? 2 : 1,
      dailyGoalMinutes: chosenPref.dailyGoalMinutes || 15,
    },
  };
}
