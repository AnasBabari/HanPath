import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAllStories, type Story } from '../storiesApi';

describe('Stories API Utility', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('successfully aggregates stories from all HSK levels', async () => {
    const mockStory: Story = {
      id: 'hsk1-story-1',
      title: 'Greeting a friend',
      title_zh: '问候朋友',
      hsk_level: 1,
      tokens: [
        {
          token: '你好',
          is_word: true,
          hsk_level: 1,
          pinyin_hint: 'nǐ hǎo',
          meaning: 'hello',
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('stories_hsk1.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockStory]),
        } as unknown as Response);
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve([]),
      } as unknown as Response);
    });

    const stories = await fetchAllStories();
    expect(stories.length).toBe(1);
    expect(stories[0].id).toBe('hsk1-story-1');
    expect(stories[0].tokens[0].token).toBe('你好');
  });

  it('handles fetch errors gracefully without throwing', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const stories = await fetchAllStories();
    expect(Array.isArray(stories)).toBe(true);
    expect(stories.length).toBe(0);
  });
});
