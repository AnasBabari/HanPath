import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStoriesForLevel, storySchema } from '../generate_stories.mjs';

// Mock the @google/generative-ai library
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: vi.fn().mockResolvedValue({
            response: {
              text: () => JSON.stringify([
                {
                  id: "test-story",
                  title: "Test Story",
                  title_zh: "测试故事",
                  hsk_level: 1,
                  tokens: [
                    { token: "我", is_word: true, hsk_level: 1, pinyin_hint: "wǒ", meaning: "I/me" },
                    { token: "是", is_word: true, hsk_level: 1, pinyin_hint: "shì", meaning: "am/is/are" },
                    { token: "猫", is_word: true, hsk_level: 1, pinyin_hint: "māo", meaning: "cat" },
                    { token: "。", is_word: false, hsk_level: 0, pinyin_hint: "", meaning: "" }
                  ]
                }
              ])
            }
          })
        };
      }
    },
    SchemaType: {
      OBJECT: 'object',
      STRING: 'string',
      BOOLEAN: 'boolean',
      NUMBER: 'number',
      ARRAY: 'array'
    }
  };
});

describe('generateStoriesForLevel API script', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should request stories for the specified HSK level', async () => {
    const stories = await generateStoriesForLevel(1);
    
    expect(stories).toBeDefined();
    expect(Array.isArray(stories)).toBe(true);
    expect(stories.length).toBe(4);
    
    const story = stories[0];
    expect(story.id).toBe("test-story");
    expect(story.hsk_level).toBe(1);
    expect(story.tokens).toBeDefined();
    expect(story.tokens.length).toBe(4);
    
    const firstWord = story.tokens[0];
    expect(firstWord.token).toBe("我");
    expect(firstWord.is_word).toBe(true);
    expect(firstWord.pinyin_hint).toBe("wǒ");
  }, 30000);

  it('should have correctly exported schemas', () => {
    expect(storySchema).toBeDefined();
    expect(storySchema.type).toBe('array');
    expect(storySchema.items.type).toBe('object');
    expect(storySchema.items.required).toContain('id');
    expect(storySchema.items.required).toContain('tokens');
  });
});
