import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

interface StoryToken {
  token: string;
  is_word: boolean;
  hsk_level: number;
  pinyin_hint: string;
  meaning: string;
  is_support?: boolean;
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
  const curriculum = JSON.parse(
    fs.readFileSync(path.join(srcDataDir, 'curriculum_hsk3_v1.json'), 'utf8')
  ) as {
    hsk1: Array<{ hanzi: string; hskLevel: number }>;
    hsk2: Array<{ hanzi: string; hskLevel: number }>;
  };

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
      const curriculumWords = new Map(
        (level === 1 ? curriculum.hsk1 : [...curriculum.hsk1, ...curriculum.hsk2])
          .map(word => [word.hanzi, word.hskLevel])
      );

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

        // Truthful automated-review metadata (no unsupported human-review claim)
        expect(story.reviewStatus).toBe('automated-reviewed');
        expect(story.reviewer).toBe('HanPath corpus validation suite');
        expect(story.curriculumStandard).toBe('HSK-3.0-aligned-v1.4');
        expect(typeof story.reviewDate).toBe('string');

        // Token-level integrity
        expect(Array.isArray(story.tokens)).toBe(true);
        expect(story.tokens.length).toBeGreaterThanOrEqual(15);

        let supportWordCount = 0;
        let wordCount = 0;
        for (const t of story.tokens) {
          expect(typeof t.token).toBe('string');
          expect(t.token.length).toBeGreaterThan(0);

          if (t.is_word) {
            wordCount += 1;
            expect(t.pinyin_hint.length).toBeGreaterThan(0);
            expect(t.meaning.length).toBeGreaterThan(0);
            // Word meanings must be word-specific, not whole sentence blocks
            expect(t.meaning.length).toBeLessThan(60);
            const curriculumLevel = curriculumWords.get(t.token);
            if (curriculumLevel) {
              expect(t.is_support).not.toBe(true);
              expect(t.hsk_level).toBe(curriculumLevel);
              expect(t.hsk_level).toBeLessThanOrEqual(level);
            } else {
              supportWordCount += 1;
              expect(t.is_support).toBe(true);
              expect(t.hsk_level).toBe(0);
            }
          } else {
            expect(t.hsk_level).toBe(0);
            expect(t.pinyin_hint).toBe('');
            expect(t.meaning).toBe('');
          }
        }

        // Keep non-curriculum vocabulary bounded and individually glossed.
        expect(supportWordCount / wordCount).toBeLessThanOrEqual(0.35);
      }
    }
  });
});
