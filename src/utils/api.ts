/**
 * HSK 3.0 Curriculum & Dataset API
 * Sourced from canonical official syllabus (chinesetest.cn) and normalized via MIT dataset.
 * 100% pre-bundled and offline-available (Zero runtime GitHub downloads).
 */

import type { HSKWord } from '../types';
import curriculumData from '../data/curriculum_hsk3_v1.json';

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

export function getCurriculumMetadata(): CurriculumMetadata {
  return {
    standard: curriculumData.standard,
    syllabusSource: curriculumData.syllabusSource,
    normalizedDatasetSource: curriculumData.normalizedDatasetSource,
    license: curriculumData.license,
    retrievalDate: curriculumData.retrievalDate,
    schemaVersion: curriculumData.schemaVersion,
    counts: curriculumData.counts,
    sha256: curriculumData.sha256,
  };
}

/**
 * Returns pre-bundled HSK vocabulary for level 1 or 2
 */
export async function fetchHSKLevel(level: number): Promise<HSKWord[]> {
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
  const fileName = `/data/hsk${targetLevel}_sentences.json`;

  try {
    const res = await fetch(fileName);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data as HSKSentence[];
    }
  } catch (err) {
    console.warn(`Failed to fetch ${fileName}, falling back to static sentences:`, err);
  }

  // Fallback static sentences
  if (targetLevel === 2) {
    return [
      {
        id: 201,
        hsk: 2,
        zh: '我想去跑步',
        en: 'I want to go running',
        py: 'wǒ xiǎng qù pǎobù',
        tiles: ['我', '想', '去', '跑步'],
        required_words: ['我', '想', '去', '跑步'],
      },
      {
        id: 202,
        hsk: 2,
        zh: '他帮我准备早饭',
        en: 'He helps me prepare breakfast',
        py: 'tā bāng wǒ zhǔnbèi zǎofàn',
        tiles: ['他', '帮', '我', '准备', '早饭'],
        required_words: ['他', '帮', '我', '准备', '早饭'],
      },
    ];
  }

  return [
    {
      id: 1,
      hsk: 1,
      zh: '我是学生',
      en: 'I am a student',
      py: 'wǒ shì xué shēng',
      tiles: ['我', '是', '学生'],
      required_words: ['我', '是', '学生'],
    },
    {
      id: 2,
      hsk: 1,
      zh: '她喝水',
      en: 'She drinks water',
      py: 'tā hē shuǐ',
      tiles: ['她', '喝', '水'],
      required_words: ['她', '喝', '水'],
    },
  ];
}
