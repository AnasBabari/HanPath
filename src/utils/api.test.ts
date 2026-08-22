import { describe, it, expect } from 'vitest';
import { fetchHSKLevel, fetchSentencesForLevel, getCurriculumMetadata } from './api';

describe('HSK 3.0 Curriculum API (Offline Bundled)', () => {
  it('returns valid metadata with exact canonical HSK 3.0 standard counts', () => {
    const meta = getCurriculumMetadata();
    expect(meta.standard).toBe('HSK-3.0-2021');
    expect(meta.license).toBe('MIT');
    expect(meta.counts.hsk1).toBe(500);
    expect(meta.counts.hsk2).toBe(750);
    expect(meta.counts.cumulative).toBe(1250);
    expect(meta.sha256).toBeDefined();
    expect(meta.sha256.length).toBe(64);
  });

  it('loads exact 500 HSK 1 vocabulary words directly from bundled dataset', async () => {
    const words = await fetchHSKLevel(1);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBe(500);
    expect(words[0].hanzi).toBeDefined();
    expect(words[0].pinyin).toBeDefined();
    expect(words[0].hskLevel).toBe(1);

    const uniqueHanzi = new Set(words.map((w) => w.hanzi));
    expect(uniqueHanzi.size).toBe(500);
  });

  it('loads exact 750 HSK 2 vocabulary words directly from bundled dataset', async () => {
    const words = await fetchHSKLevel(2);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBe(750);
    expect(words[0].hanzi).toBeDefined();
    expect(words[0].pinyin).toBeDefined();
    expect(words[0].hskLevel).toBe(2);

    const uniqueHanzi = new Set(words.map((w) => w.hanzi));
    expect(uniqueHanzi.size).toBe(750);
  });

  it('provides sentence structures for Level 1 and Level 2 without errors', async () => {
    const s1 = await fetchSentencesForLevel(1);
    const s2 = await fetchSentencesForLevel(2);

    expect(Array.isArray(s1)).toBe(true);
    expect(s1.length).toBeGreaterThan(0);
    expect(s1[0].tiles.length).toBeGreaterThan(0);

    expect(Array.isArray(s2)).toBe(true);
    expect(s2.length).toBeGreaterThan(0);
    expect(s2[0].tiles.length).toBeGreaterThan(0);
  });
});
