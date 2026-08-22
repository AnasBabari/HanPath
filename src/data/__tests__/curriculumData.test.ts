import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface SentenceItem {
  id: number;
  hsk: number;
  zh: string;
  en: string;
  py: string;
  tiles: string[];
  required_words: string[];
}

interface CurriculumArtifact {
  standard: string;
  syllabusReference: string;
  normalizedDatasetSource: string;
  pinnedCommit: string;
  license: string;
  retrievalDate: string;
  schemaVersion: number;
  counts: {
    hsk1: number;
    hsk2: number;
    cumulative: number;
  };
  sha256: string;
  hsk1: Array<{ id: string; hanzi: string; pinyin: string; meanings: string[]; hskLevel: number }>;
  hsk2: Array<{ id: string; hanzi: string; pinyin: string; meanings: string[]; hskLevel: number }>;
}

describe('Curriculum Data Integrity & Provenance Validation', () => {
  const dataDir = path.resolve(process.cwd(), 'public', 'data');
  const srcDataDir = path.resolve(process.cwd(), 'src', 'data');

  it('validates canonical bundled HSK 3.0 curriculum artifact (curriculum_hsk3_v1.json)', () => {
    const filePath = path.join(srcDataDir, 'curriculum_hsk3_v1.json');
    expect(fs.existsSync(filePath), 'curriculum_hsk3_v1.json must exist').toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    const artifact = JSON.parse(raw) as CurriculumArtifact;

    expect(artifact.standard).toBe('HSK-3.0-2021');
    expect(artifact.syllabusReference).toBe('https://www.chinesetest.cn/HSK');
    expect(artifact.pinnedCommit).toBe('7ac65bf1a6387d35f1ade478906172a19311c7f9');
    expect(artifact.license).toBe('MIT');
    expect(artifact.counts.hsk1).toBe(500);
    expect(artifact.counts.hsk2).toBe(750);
    expect(artifact.counts.cumulative).toBe(1250);

    // Validate SHA256 integrity
    const copy = { ...artifact, sha256: undefined };
    delete copy.sha256;
    const computedHash = crypto.createHash('sha256').update(JSON.stringify(copy, null, 2)).digest('hex');
    expect(computedHash).toBe(artifact.sha256);

    // Verify HSK 1 words
    const hsk1Ids = new Set<string>();
    for (const w of artifact.hsk1) {
      expect(typeof w.id).toBe('string');
      expect(hsk1Ids.has(w.id)).toBe(false);
      hsk1Ids.add(w.id);
      expect(w.hskLevel).toBe(1);
      expect(/[\u4e00-\u9fff]/.test(w.hanzi)).toBe(true);
      expect(w.pinyin.length).toBeGreaterThan(0);
      expect(w.meanings.length).toBeGreaterThan(0);
    }

    // Verify HSK 2 words
    const hsk2Ids = new Set<string>();
    for (const w of artifact.hsk2) {
      expect(typeof w.id).toBe('string');
      expect(hsk2Ids.has(w.id)).toBe(false);
      hsk2Ids.add(w.id);
      expect(w.hskLevel).toBe(2);
      expect(/[\u4e00-\u9fff]/.test(w.hanzi)).toBe(true);
      expect(w.pinyin.length).toBeGreaterThan(0);
      expect(w.meanings.length).toBeGreaterThan(0);
    }
  });

  it('validates public/data/hsk1_sentences.json and hsk2_sentences.json contracts', () => {
    for (const level of [1, 2]) {
      const filePath = path.join(dataDir, `hsk${level}_sentences.json`);
      expect(fs.existsSync(filePath), `hsk${level}_sentences.json must exist`).toBe(true);

      const raw = fs.readFileSync(filePath, 'utf8');
      const sentences = JSON.parse(raw) as SentenceItem[];

      expect(Array.isArray(sentences)).toBe(true);
      expect(sentences.length).toBeGreaterThan(0);

      const seenIds = new Set<number>();

      for (const item of sentences) {
        expect(typeof item.id).toBe('number');
        expect(seenIds.has(item.id), `Sentence ID ${item.id} must be unique`).toBe(false);
        seenIds.add(item.id);

        expect(item.hsk).toBe(level);
        expect(typeof item.zh).toBe('string');
        expect(item.zh.trim().length).toBeGreaterThan(0);
        expect(/[\u4e00-\u9fff]/.test(item.zh), `Sentence ${item.id} must contain Hanzi`).toBe(true);
        expect(typeof item.en).toBe('string');
        expect(typeof item.py).toBe('string');
        expect(Array.isArray(item.tiles)).toBe(true);
        expect(item.tiles.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
