import type { WordSRSData } from '../types';

export function updateSRS(word: WordSRSData | undefined, wordId: string, quality: 0 | 1 | 2 | 3 | 4 | 5): WordSRSData {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const w = word || { wordId, easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewDate: todayStr };

  if (quality < 3) {
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + 1);
    return { ...w, repetitions: 0, interval: 1, nextReviewDate: nextDate.toISOString().split('T')[0] };
  }
  
  const newEF = Math.max(1.3, w.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const newInterval = w.repetitions === 0 ? 1 : w.repetitions === 1 ? 6 : Math.round(w.interval * newEF);
  
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + newInterval);
  
  return {
    wordId,
    easeFactor: newEF,
    interval: newInterval,
    repetitions: w.repetitions + 1,
    nextReviewDate: nextDate.toISOString().split('T')[0]
  };
}

export function getDueWords(srsRecord: Record<string, WordSRSData>): string[] {
  const today = new Date().toISOString().split('T')[0];
  return Object.values(srsRecord)
    .filter(w => w.nextReviewDate <= today)
    .map(w => w.wordId);
}
