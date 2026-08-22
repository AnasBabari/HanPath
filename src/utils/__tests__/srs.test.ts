import { describe, it, expect } from 'vitest';
import { updateSRS, getDueWords } from '../srs';
import type { WordSRSData } from '../../types';

describe('SM-2 Spaced Repetition System (SRS)', () => {
  const baseDate = new Date('2026-08-14T00:00:00.000Z');

  it('initializes a brand new word on first successful review (quality 4)', () => {
    const wordId = 'word-1';
    const result = updateSRS(undefined, wordId, 4, baseDate);

    expect(result.wordId).toBe(wordId);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBe(2.5);
    expect(result.nextReviewDate).toBe('2026-08-15');
    expect(result.updatedAt).toBeDefined();
  });

  it('follows SM-2 standard progression: 1 day -> 6 days -> round(6 * EF)', () => {
    const r1 = updateSRS(undefined, 'word-1', 4, baseDate);
    expect(r1.interval).toBe(1);
    expect(r1.repetitions).toBe(1);

    const r2Date = new Date('2026-08-15T00:00:00.000Z');
    const r2 = updateSRS(r1, 'word-1', 4, r2Date);
    expect(r2.interval).toBe(6);
    expect(r2.repetitions).toBe(2);

    const r3Date = new Date('2026-08-21T00:00:00.000Z');
    const r3 = updateSRS(r2, 'word-1', 4, r3Date);
    expect(r3.interval).toBe(Math.round(6 * r2.easeFactor)); // 6 * 2.5 = 15
    expect(r3.repetitions).toBe(3);
    expect(r3.nextReviewDate).toBe('2026-09-05');
  });

  it('increases ease factor for easy ratings (quality 5)', () => {
    const r1 = updateSRS(undefined, 'word-1', 5, baseDate);
    expect(r1.easeFactor).toBeGreaterThan(2.5);
  });

  it('decreases ease factor for hard ratings (quality 3)', () => {
    const r1 = updateSRS(undefined, 'word-1', 3, baseDate);
    expect(r1.easeFactor).toBeLessThan(2.5);
  });

  it('enforces ease factor floor of 1.3 upon repeated failures', () => {
    let current: WordSRSData | undefined = undefined;
    for (let i = 0; i < 15; i++) {
      current = updateSRS(current, 'hard-word', 1, baseDate);
    }
    expect(current!.easeFactor).toBe(1.3);
    expect(current!.interval).toBe(1);
    expect(current!.repetitions).toBe(0);
  });

  it('resets repetitions and interval on failure (< 3) after building a high interval', () => {
    const masteredWord: WordSRSData = {
      wordId: 'mastered',
      interval: 45,
      easeFactor: 2.6,
      repetitions: 6,
      nextReviewDate: '2026-08-14',
      updatedAt: '2026-08-14T00:00:00.000Z',
    };

    const failed = updateSRS(masteredWord, 'mastered', 1, baseDate);
    expect(failed.repetitions).toBe(0);
    expect(failed.interval).toBe(1);
    expect(failed.nextReviewDate).toBe('2026-08-15');
  });

  it('correctly filters due words based on reference date', () => {
    const records: Record<string, WordSRSData> = {
      w1: { wordId: 'w1', interval: 1, easeFactor: 2.5, repetitions: 1, nextReviewDate: '2026-08-13', updatedAt: '2026-08-13T00:00:00.000Z' }, // Overdue
      w2: { wordId: 'w2', interval: 1, easeFactor: 2.5, repetitions: 1, nextReviewDate: '2026-08-14', updatedAt: '2026-08-14T00:00:00.000Z' }, // Due today
      w3: { wordId: 'w3', interval: 5, easeFactor: 2.5, repetitions: 2, nextReviewDate: '2026-08-19', updatedAt: '2026-08-14T00:00:00.000Z' }, // Future
    };

    const dueToday = getDueWords(records, '2026-08-14');
    expect(dueToday).toContain('w1');
    expect(dueToday).toContain('w2');
    expect(dueToday).not.toContain('w3');
  });
});
