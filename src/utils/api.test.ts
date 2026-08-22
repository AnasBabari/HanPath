import { describe, it, expect } from 'vitest';
import { fetchHSKLevel, fetchSentencesForLevel, getCurriculumMetadata } from './api';

describe('HSK 3.0 Curriculum API (Offline Bundled)', () => {
  it('returns valid metadata with canonical HSK 3.0 standard', () => {
    const meta = getCurriculumMetadata();
    expect(meta.standard).toBe('HSK-3.0');
    expect(meta.license).toBe('MIT');
    expect(meta.counts.hsk1).toBeGreaterThanOrEqual(500);
    expect(meta.counts.hsk2).toBeGreaterThanOrEqual(750);
    expect(meta.counts.cumulative).toBeGreaterThanOrEqual(1250);
    expect(meta.sha256).toBeDefined();
  });

  it('loads HSK 1 vocabulary words directly from bundled dataset', async () => {
    const words = await fetchHSKLevel(1);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeGreaterThanOrEqual(500);
    expect(words[0].hanzi).toBeDefined();
    expect(words[0].pinyin).toBeDefined();
    expect(words[0].hskLevel).toBe(1);
  });

  it('loads HSK 2 vocabulary words directly from bundled dataset', async () => {
    const words = await fetchHSKLevel(2);
    expect(Array.isArray(words)).toBe(true);
    expect(words.length).toBeGreaterThanOrEqual(750);
    expect(words[0].hanzi).toBeDefined();
    expect(words[0].pinyin).toBeDefined();
    expect(words[0].hskLevel).toBe(2);
  });

  it('provides sentence structures for Level 1 and Level 2', async () => {
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
