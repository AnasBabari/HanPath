/**
 * Spaced Repetition System (SRS) — SuperMemo SM-2 Algorithm
 * 
 * Algorithm Specification:
 * 1. Initial State:
 *    - repetitions = 0
 *    - interval = 0 (or 1 on first review)
 *    - easeFactor (EF) = 2.5
 * 
 * 2. Quality Rating (0 to 5):
 *    - 5: Perfect response / "Easy"
 *    - 4: Correct response after hesitation / "Good"
 *    - 2-3: Correct response with serious difficulty / "Hard"
 *    - 0-1: Complete blackout / Incorrect
 * 
 * 3. Ease Factor (EF) Calculation:
 *    - EF' = max(1.3, EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
 * 
 * 4. Interval Calculation:
 *    - If quality < 3 (failure): repetitions = 0, interval = 1 day
 *    - If quality >= 3:
 *        - For repetitions == 0: interval = 1 day
 *        - For repetitions == 1: interval = 6 days
 *        - For repetitions >= 2: interval = round(previous_interval * EF')
 *        - repetitions = repetitions + 1
 */

import type { WordSRSData } from '../types';

export function updateSRS(
  word: WordSRSData | undefined,
  wordId: string,
  quality: 0 | 1 | 2 | 3 | 4 | 5,
  currentDate = new Date()
): WordSRSData {
  const todayStr = currentDate.toISOString().split('T')[0];
  
  const w: WordSRSData = word || {
    wordId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: todayStr,
  };

  // Failure / Hard reset under threshold
  if (quality < 3) {
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);
    return {
      wordId,
      repetitions: 0,
      interval: 1,
      easeFactor: Math.max(1.3, w.easeFactor - 0.2),
      nextReviewDate: nextDate.toISOString().split('T')[0],
    };
  }
  
  // Standard SM-2 ease factor equation
  const newEF = Math.max(1.3, w.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Standard SM-2 repetition intervals
  const newInterval = w.repetitions === 0
    ? 1
    : w.repetitions === 1
      ? 6
      : Math.round(w.interval * newEF);
  
  const nextDate = new Date(currentDate);
  nextDate.setDate(currentDate.getDate() + newInterval);
  
  return {
    wordId,
    easeFactor: Number(newEF.toFixed(2)),
    interval: newInterval,
    repetitions: w.repetitions + 1,
    nextReviewDate: nextDate.toISOString().split('T')[0],
  };
}

/**
 * Returns list of word IDs due for review on or before the reference date (defaults to today).
 */
export function getDueWords(
  srsRecord: Record<string, WordSRSData>,
  referenceDateStr = new Date().toISOString().split('T')[0]
): string[] {
  return Object.values(srsRecord).reduce<string[]>((due, w) => {
    if (w.nextReviewDate <= referenceDateStr) {
      due.push(w.wordId);
    }
    return due;
  }, []);
}
