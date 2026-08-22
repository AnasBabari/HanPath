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
  syllabusSource: string;
  normalizedDatasetSource: string;
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

import meta from '../data/curriculum_meta.json';

export function getCurriculumMetadata(): CurriculumMetadata {
  return meta;
}

/**
 * Returns pre-bundled HSK vocabulary for level 1 or 2
 */
export async function fetchHSKLevel(level: number): Promise<HSKWord[]> {
  const mod = await import('../data/curriculum_hsk3_v1.json');
  const curriculumData = mod.default || mod;
  if (level === 2) {
    return curriculumData.hsk2 as unknown as HSKWord[];
  }
  return curriculumData.hsk1 as unknown as HSKWord[];
}

/**
 * Returns pre-bundled sentence data for level 1 or 2
 */
export async function fetchSentencesForLevel(level: number): Promise<HSKSentence[]> {
  const targetLevel = level === 2 ? 2 : 1;
  if (targetLevel === 2) {
    const mod = await import('../data/sentences_hsk2.json');
    return (mod.default || mod) as unknown as HSKSentence[];
  }
  const mod = await import('../data/sentences_hsk1.json');
  return (mod.default || mod) as unknown as HSKSentence[];
}
