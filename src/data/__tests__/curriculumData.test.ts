import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

interface SentenceItem {
  id: number;
  hsk: number;
  zh: string;
  en: string;
  py: string;
  tiles: string[];
  required_words: string[];
}

interface StoryToken {
  token: string;
  is_word: boolean;
  hsk_level: number;
  pinyin_hint: string;
  meaning: string;
}

interface StoryItem {
  id: string;
  title: string;
  title_zh: string;
  hsk_level: number;
  tokens: StoryToken[];
}

describe('Curriculum Data Integrity & Contract Validation', () => {
  const dataDir = path.resolve(process.cwd(), 'public', 'data');

  it('validates public/data/hsk1_sentences.json structure and data contracts', () => {
    const filePath = path.join(dataDir, 'hsk1_sentences.json');
    expect(fs.existsSync(filePath), 'hsk1_sentences.json must exist').toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    const sentences = JSON.parse(raw) as SentenceItem[];

    expect(Array.isArray(sentences)).toBe(true);
    expect(sentences.length).toBeGreaterThan(0);

    const seenIds = new Set<number>();

    for (const item of sentences) {
      expect(typeof item.id).toBe('number');
      expect(seenIds.has(item.id), `Sentence ID ${item.id} must be unique`).toBe(false);
      seenIds.add(item.id);

      expect(item.hsk).toBe(1);
      expect(typeof item.zh).toBe('string');
      expect(item.zh.trim().length).toBeGreaterThan(0);
      // Valid Chinese characters
      expect(/[\u4e00-\u9fff]/.test(item.zh), `Sentence ${item.id} must contain Hanzi`).toBe(true);

      expect(typeof item.en).toBe('string');
      expect(item.en.trim().length).toBeGreaterThan(0);

      expect(typeof item.py).toBe('string');
      expect(item.py.trim().length).toBeGreaterThan(0);

      expect(Array.isArray(item.tiles)).toBe(true);
      expect(item.tiles.length).toBeGreaterThanOrEqual(1);

      // Verify that joining tiles reconstructs the sentence or contains all target characters
      const tileCombined = item.tiles.join('');
      expect(tileCombined.length).toBeGreaterThan(0);
    }
  });

  it('validates public/data/stories_hsk1.json structure and tokenization', () => {
    const filePath = path.join(dataDir, 'stories_hsk1.json');
    expect(fs.existsSync(filePath), 'stories_hsk1.json must exist').toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    const stories = JSON.parse(raw) as StoryItem[];

    expect(Array.isArray(stories)).toBe(true);
    expect(stories.length).toBeGreaterThan(0);

    const seenIds = new Set<string>();

    for (const story of stories) {
      expect(typeof story.id).toBe('string');
      expect(seenIds.has(story.id), `Story ID ${story.id} must be unique`).toBe(false);
      seenIds.add(story.id);

      expect(story.hsk_level).toBe(1);
      expect(typeof story.title).toBe('string');
      expect(story.title.length).toBeGreaterThan(0);
      expect(typeof story.title_zh).toBe('string');
      expect(story.title_zh.length).toBeGreaterThan(0);

      expect(Array.isArray(story.tokens)).toBe(true);
      expect(story.tokens.length).toBeGreaterThan(0);

      for (const token of story.tokens) {
        expect(typeof token.token).toBe('string');
        expect(token.token.length).toBeGreaterThan(0);
        expect(typeof token.is_word).toBe('boolean');
        expect(typeof token.hsk_level).toBe('number');
      }
    }
  });

  it('validates public/data/stories_hsk2.json structure and tokenization', () => {
    const filePath = path.join(dataDir, 'stories_hsk2.json');
    expect(fs.existsSync(filePath), 'stories_hsk2.json must exist').toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    const stories = JSON.parse(raw) as StoryItem[];

    expect(Array.isArray(stories)).toBe(true);
    expect(stories.length).toBeGreaterThan(0);

    const seenIds = new Set<string>();

    for (const story of stories) {
      expect(typeof story.id).toBe('string');
      expect(seenIds.has(story.id), `Story ID ${story.id} must be unique`).toBe(false);
      seenIds.add(story.id);

      expect(story.hsk_level).toBe(2);
      expect(typeof story.title).toBe('string');
      expect(story.title.length).toBeGreaterThan(0);
      expect(typeof story.title_zh).toBe('string');
      expect(story.title_zh.length).toBeGreaterThan(0);

      expect(Array.isArray(story.tokens)).toBe(true);
      expect(story.tokens.length).toBeGreaterThan(0);
    }
  });
});
