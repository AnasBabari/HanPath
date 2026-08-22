import type { HSKWord } from '../types';

export interface HSKSentence {
  id: number;
  hsk: number;
  zh: string;
  en: string;
  py: string;
  tiles: string[];
  required_words: string[];
}

export interface CurriculumMetadata {
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
}

const STATIC_METADATA: CurriculumMetadata = {
  standard: 'HSK-3.0-2021',
  syllabusReference: 'https://www.chinesetest.cn/HSK',
  normalizedDatasetSource: 'https://github.com/drkameleon/complete-hsk-vocabulary/tree/7ac65bf1a6387d35f1ade478906172a19311c7f9',
  pinnedCommit: '7ac65bf1a6387d35f1ade478906172a19311c7f9',
  license: 'MIT',
  retrievalDate: '2026-08-22',
  schemaVersion: 1,
  counts: {
    hsk1: 500,
    hsk2: 750,
    cumulative: 1250,
  },
  sha256: 'd849d1b2fa9e5afb6893db185507e68d205177e90a7aae66ce689d4f6c399acc',
};

export function getCurriculumMetadata(): CurriculumMetadata {
  return STATIC_METADATA;
}

/**
 * Returns pre-bundled HSK vocabulary for level 1 or 2
 */
export async function fetchHSKLevel(level: number): Promise<HSKWord[]> {
  const curriculumData = await import('../data/curriculum_hsk3_v1.json');
  if (level === 2) {
    return curriculumData.hsk2 as unknown as HSKWord[];
  }
  return curriculumData.hsk1 as unknown as HSKWord[];
}

/**
 * Returns pre-bundled sentence data for level 1 or 2
 */
export async function fetchSentencesForLevel(level: number): Promise<HSKSentence[]> {
  if (level === 2) {
    const s2 = await import('../data/sentences_hsk2.json');
    return (s2.default || s2) as unknown as HSKSentence[];
  }
  const s1 = await import('../data/sentences_hsk1.json');
  return (s1.default || s1) as unknown as HSKSentence[];
}
