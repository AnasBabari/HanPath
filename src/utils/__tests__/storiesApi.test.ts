import { describe, it, expect } from 'vitest';
import { fetchAllStories } from '../storiesApi';

describe('Stories API Utility', () => {
  it('loads exactly 8 original graded stories for HSK 1 and 8 for HSK 2 (16 total)', async () => {
    const stories = await fetchAllStories();
    expect(Array.isArray(stories)).toBe(true);
    expect(stories.length).toBe(16);

    const hsk1Stories = stories.filter((s) => s.hsk_level === 1);
    const hsk2Stories = stories.filter((s) => s.hsk_level === 2);

    expect(hsk1Stories.length).toBe(8);
    expect(hsk2Stories.length).toBe(8);

    for (const story of stories) {
      expect(story.id).toBeDefined();
      expect(story.title).toBeDefined();
      expect(story.title_zh).toBeDefined();
      expect(Array.isArray(story.tokens)).toBe(true);
      expect(story.tokens.length).toBeGreaterThan(0);

      // Check token schema
      for (const token of story.tokens) {
        expect(token.token).toBeDefined();
        expect(typeof token.is_word).toBe('boolean');
        expect(typeof token.hsk_level).toBe('number');
      }
    }
  });
});
