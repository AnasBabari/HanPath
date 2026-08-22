import { describe, it, expect } from 'vitest';
import {
  buildCurriculum,
  isLessonUnlocked,
  nextLessonId,
  findLesson,
  allLessonsFlat,
} from '../curriculum';
import type { HSKWord } from '../../types';
import type { HSKSentence } from '../api';

describe('Curriculum Builder Logic (Deterministic 5 Vocab + 1 Checkpoint)', () => {
  const mockWords: HSKWord[] = Array.from({ length: 20 }, (_, i) => ({
    id: `hsk1-${i + 1}`,
    hanzi: `字${i + 1}`,
    pinyin: `zì${i + 1}`,
    meanings: [`meaning ${i + 1}`],
    hskLevel: 1,
  }));

  const mockSentences: HSKSentence[] = [
    {
      id: 1,
      hsk: 1,
      zh: '字1字2',
      en: 'Word 1 Word 2',
      py: 'zì1 zì2',
      tiles: ['字1', '字2'],
      required_words: ['字1'],
    },
  ];

  it('builds deterministic units with vocabulary lessons and unit checkpoint', () => {
    const units = buildCurriculum(mockWords, mockSentences);
    expect(units.length).toBe(1);

    const flat = allLessonsFlat(units);
    // 20 words = 2 vocab lessons (10 words each) + 1 checkpoint lesson = 3 lessons
    expect(flat.length).toBe(3);

    expect(flat[0].vocab.length).toBe(10);
    expect(flat[1].vocab.length).toBe(10);
    expect(flat[2].title).toBe('Unit Checkpoint');
    expect(flat[0].exercises.length).toBeGreaterThan(0);
  });

  it('correctly tracks lesson unlocking progression', () => {
    const units = buildCurriculum(mockWords, mockSentences);
    const flat = allLessonsFlat(units);

    // Lesson 1 is unlocked initially
    expect(isLessonUnlocked(flat[0].id, [], units)).toBe(true);

    // Lesson 2 is locked until Lesson 1 is completed
    expect(isLessonUnlocked(flat[1].id, [], units)).toBe(false);
    expect(isLessonUnlocked(flat[1].id, [flat[0].id], units)).toBe(true);
  });

  it('finds lessons and retrieves next lesson id', () => {
    const units = buildCurriculum(mockWords, mockSentences);
    const flat = allLessonsFlat(units);

    const found = findLesson(units, flat[0].id);
    expect(found).not.toBeNull();
    expect(found?.lesson.id).toBe(flat[0].id);

    const nextId = nextLessonId(units, flat[0].id);
    expect(nextId).toBe(flat[1].id);

    const finalNextId = nextLessonId(units, flat[flat.length - 1].id);
    expect(finalNextId).toBeNull();
  });
});
