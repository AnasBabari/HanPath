import { describe, it, expect } from 'vitest';
import { updateSRS } from '../srs';
import type { WordSRSData } from '../../types';

describe('SM-2 Spaced Repetition Logic', () => {
  it('initializes a new word on first review (quality 4)', () => {
    const wordId = 'test-word';
    const result = updateSRS(undefined, wordId, 4);
    
    expect(result.wordId).toBe(wordId);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);
  });

  it('resets interval when quality is low (quality 2)', () => {
    const existing: WordSRSData = {
      wordId: 'test-word',
      interval: 10,
      easeFactor: 2.5,
      nextReviewDate: '2020-01-01',
      repetitions: 5
    };
    const result = updateSRS(existing, 'test-word', 2);
    
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('increases interval for successful repetitions', () => {
    const firstReview = updateSRS(undefined, 'word1', 4);
    expect(firstReview.interval).toBe(1);
    
    const secondReview = updateSRS(firstReview, 'word1', 4);
    expect(secondReview.interval).toBe(6);
    
    const thirdReview = updateSRS(secondReview, 'word1', 4);
    expect(thirdReview.interval).toBeGreaterThan(6);
  });
});
