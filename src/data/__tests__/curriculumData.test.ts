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
  datasetStatus: string;
  upstreamRelease: string;
  provenanceNotice: string;
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

    expect(artifact.standard).toBe('HSK-3.0-aligned-v1.4');
    expect(artifact.datasetStatus).toBe('community-curated');
    expect(artifact.upstreamRelease).toBe('v1.4');
    expect(artifact.provenanceNotice).toContain('not an official');
    expect(artifact.syllabusReference).toBe('https://www.chinesetest.cn/HSK');
    expect(artifact.pinnedCommit).toBe('7ac65bf1a6387d35f1ade478906172a19311c7f9');
    expect(artifact.license).toBe('MIT');
    expect(artifact.counts.hsk1).toBe(506);
    expect(artifact.counts.hsk2).toBe(750);
    expect(artifact.counts.cumulative).toBe(1256);

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

  it('validates linguistic accuracy and pedagogical overrides for beginner vocabulary', () => {
    const filePath = path.join(srcDataDir, 'curriculum_hsk3_v1.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const artifact = JSON.parse(raw) as CurriculumArtifact;
    const allWords = [...artifact.hsk1, ...artifact.hsk2];

    const findWord = (hanzi: string) => allWords.find(w => w.hanzi === hanzi);

    // Verify key beginner semantic disambiguations
    const ba = findWord('吧');
    expect(ba).toBeDefined();
    expect(ba?.pinyin).toBe('ba');
    expect(ba?.meanings.some(m => m.includes('modal particle') || m.includes('suggestion'))).toBe(true);

    const bai = findWord('百');
    expect(bai).toBeDefined();
    expect(bai?.pinyin).toBe('bǎi');
    expect(bai?.meanings.some(m => m.includes('hundred'))).toBe(true);

    const bi = findWord('比');
    expect(bi).toBeDefined();
    expect(bi?.pinyin).toBe('bǐ');
    expect(bi?.meanings.some(m => m.includes('compare'))).toBe(true);

    const bie = findWord('别');
    expect(bie).toBeDefined();
    expect(bie?.pinyin).toBe('bié');
    expect(bie?.meanings.some(m => m.includes("don't") || m.includes('other'))).toBe(true);

    const che = findWord('车');
    expect(che).toBeDefined();
    expect(che?.pinyin).toBe('chē');
    expect(che?.meanings.some(m => m.includes('car') || m.includes('vehicle'))).toBe(true);

    const da = findWord('打');
    expect(da).toBeDefined();
    expect(da?.pinyin).toBe('dǎ');
    expect(da?.meanings.some(m => m.includes('hit') || m.includes('play'))).toBe(true);

    const zhongdian = findWord('重点');
    expect(zhongdian).toBeDefined();
    expect(zhongdian?.pinyin).toBe('zhòngdiǎn');
    expect(zhongdian?.meanings.some(m => m.includes('point') || m.includes('focus'))).toBe(true);

    const daxue = findWord('大学');
    expect(daxue).toBeDefined();
    expect(daxue?.pinyin).toBe('dàxué');
    expect(daxue?.meanings.some(m => m.includes('university') || m.includes('college'))).toBe(true);

    const damen = findWord('大门');
    expect(damen).toBeDefined();
    expect(damen?.pinyin).toBe('dàmén');
    expect(damen?.meanings.some(m => m.includes('entrance') || m.includes('gate') || m.includes('door'))).toBe(true);

    const youhao = findWord('友好');
    expect(youhao).toBeDefined();
    expect(youhao?.pinyin).toBe('yǒuhǎo');
    expect(youhao?.meanings.some(m => m.includes('friendly') || m.includes('amicable'))).toBe(true);

    const yaoshui = findWord('药水');
    expect(yaoshui).toBeDefined();
    expect(yaoshui?.pinyin).toBe('yàoshuǐ');
    expect(yaoshui?.meanings.some(m => m.includes('medicine'))).toBe(true);

    const ting = findWord('听');
    expect(ting).toBeDefined();
    expect(ting?.pinyin).toBe('tīng');

    const niao = findWord('鸟');
    expect(niao).toBeDefined();
    expect(niao?.pinyin).toBe('niǎo');

    const dou = findWord('都');
    expect(dou).toBeDefined();
    expect(dou?.pinyin).toBe('dōu');

    expect(findWord('考')?.meanings[0]).toContain('test');
    expect(findWord('腿')?.meanings).toContain('leg');
    expect(findWord('药')?.meanings[0]).toContain('medicine');

    const unsuitable = /(hip bone|leaf of the iris|official responsible for arranging audiences|erhua variant|abbr\. for|variant of|euphemism|\(vulgar\)|\bvulgar\b|\(archaic\)|\(old\))/i;
    for (const w of allWords) {
      expect(w.meanings.join(' '), `${w.hanzi} should not expose an obscure beginner definition`).not.toMatch(unsuitable);
    }

    // Ensure none of the beginner words have accidental surname-first meanings
    for (const w of allWords) {
      expect(w.meanings[0].toLowerCase().startsWith('surname ')).toBe(false);
      expect(w.meanings[0].toLowerCase().startsWith('euphemistic ')).toBe(false);
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
