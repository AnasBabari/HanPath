import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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
  reviewStatus: string;
  reviewer: string;
  reviewDate: string;
  curriculumStandard: string;
  tokens: StoryToken[];
}

describe('Stories Corpus Integrity, Drift Detection & Editorial Gate', () => {
  const dataDir = path.resolve(process.cwd(), 'public', 'data');
  const srcDataDir = path.resolve(process.cwd(), 'src', 'data');

  it('enforces 100% byte-identical synchronization between src/data and public/data (drift protection)', () => {
    for (const level of [1, 2]) {
      const srcPath = path.join(srcDataDir, `stories_hsk${level}.json`);
      const publicPath = path.join(dataDir, `stories_hsk${level}.json`);

      expect(fs.existsSync(srcPath), `${srcPath} must exist`).toBe(true);
      expect(fs.existsSync(publicPath), `${publicPath} must exist`).toBe(true);

      const srcContent = fs.readFileSync(srcPath, 'utf8');
      const publicContent = fs.readFileSync(publicPath, 'utf8');

      expect(srcContent).toBe(publicContent);
    }
  });

  it('verifies all 16 stories possess valid editorial metadata and coherent narrative tokens', () => {
    for (const level of [1, 2]) {
      const srcPath = path.join(srcDataDir, `stories_hsk${level}.json`);
      const raw = fs.readFileSync(srcPath, 'utf8');
      const stories = JSON.parse(raw) as StoryItem[];

      expect(Array.isArray(stories)).toBe(true);
      expect(stories.length).toBe(8); // 8 stories per level

      const seenIds = new Set<string>();

      for (const story of stories) {
        expect(seenIds.has(story.id)).toBe(false);
        seenIds.add(story.id);

        expect(story.hsk_level).toBe(level);
        expect(story.title.trim().length).toBeGreaterThan(0);
        expect(story.title_zh.trim().length).toBeGreaterThan(0);
        expect(/[\u4e00-\u9fff]/.test(story.title_zh)).toBe(true);

        // Required editorial metadata
        expect(story.reviewStatus).toBe('editorial-reviewed');
        expect(story.reviewer).toBe('HanPath Editorial Board');
        expect(story.curriculumStandard).toBe('HSK-3.0-2021');
        expect(typeof story.reviewDate).toBe('string');

        // Token-level integrity
        expect(Array.isArray(story.tokens)).toBe(true);
        expect(story.tokens.length).toBeGreaterThanOrEqual(15);

        for (const t of story.tokens) {
          expect(typeof t.token).toBe('string');
          expect(t.token.length).toBeGreaterThan(0);

          if (t.is_word) {
            expect(t.pinyin_hint.length).toBeGreaterThan(0);
            expect(t.meaning.length).toBeGreaterThan(0);
            // Word meanings must be word-specific, not whole sentence blocks
            expect(t.meaning.length).toBeLessThan(60);
            // Strict level containment: HSK 1 story words must be <= 1, HSK 2 words <= 2
            expect(t.hsk_level).toBeGreaterThanOrEqual(1);
            expect(t.hsk_level).toBeLessThanOrEqual(level);
          } else {
            expect(t.hsk_level).toBe(0);
            expect(t.pinyin_hint).toBe('');
            expect(t.meaning).toBe('');
          }
        }
      }
    }
  });
});
