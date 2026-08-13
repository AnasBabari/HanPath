import { describe, it, expect } from 'vitest';
import {
  buildCurriculum,
  isLessonUnlocked,
  nextLessonId,
  findLesson,
  allLessonsFlat,
  genSentenceBuildExercises,
  genToneDrillExercises,
  genExercisesForVocab,
} from '../curriculum';
import type { HSKWord, VocabCard } from '../../types';
import type { HSKSentence } from '../api';

describe('Curriculum Builder Logic', () => {
  const mockWords: HSKWord[] = [
    { id: 'hsk1-1', hanzi: '你好', pinyin: 'nǐ hǎo', meanings: ['hello'], hskLevel: 1 },
    { id: 'hsk1-2', hanzi: '谢谢', pinyin: 'xiè xie', meanings: ['thanks'], hskLevel: 1 },
    { id: 'hsk1-3', hanzi: '再见', pinyin: 'zài jiàn', meanings: ['goodbye'], hskLevel: 1 },
    { id: 'hsk1-4', hanzi: '水', pinyin: 'shuǐ', meanings: ['water'], hskLevel: 1 },
    { id: 'hsk1-5', hanzi: '喝', pinyin: 'hē', meanings: ['to drink'], hskLevel: 1 },
    { id: 'hsk1-6', hanzi: '茶', pinyin: 'chá', meanings: ['tea'], hskLevel: 1 },
    { id: 'hsk1-7', hanzi: '我', pinyin: 'wǒ', meanings: ['I', 'me'], hskLevel: 1 },
    { id: 'hsk1-8', hanzi: '你', pinyin: 'nǐ', meanings: ['you'], hskLevel: 1 },
  ];

  const mockSentences: HSKSentence[] = [
    {
      id: 1,
      hsk: 1,
      zh: '我喝水',
      en: 'I drink water',
      py: 'wǒ hē shuǐ',
      tiles: ['我', '喝', '水'],
      required_words: ['我', '喝', '水'],
    },
    {
      id: 2,
      hsk: 1,
      zh: '你喝茶',
      en: 'You drink tea',
      py: 'nǐ hē chá',
      tiles: ['你', '喝', '茶'],
      required_words: ['你', '喝', '茶'],
    },
  ];

  it('builds units and lessons from vocabulary cards', () => {
    const units = buildCurriculum(mockWords, mockSentences);
    expect(units.length).toBeGreaterThan(0);

    const flat = allLessonsFlat(units);
    expect(flat.length).toBe(2); // 8 words / 4 words per lesson = 2 lessons

    expect(flat[0].vocab.length).toBe(4);
    expect(flat[1].vocab.length).toBe(4);
    expect(flat[0].exercises.length).toBeGreaterThan(0);
  });

  it('correctly tracks lesson unlocking progression', () => {
    const units = buildCurriculum(mockWords, mockSentences);
    const flat = allLessonsFlat(units);

    // Lesson 1 is unlocked initially
    expect(isLessonUnlocked(flat[0].id, units, [])).toBe(true);

    // Lesson 2 is locked until Lesson 1 is completed
    expect(isLessonUnlocked(flat[1].id, units, [])).toBe(false);
    expect(isLessonUnlocked(flat[1].id, units, [flat[0].id])).toBe(true);
  });

  it('finds lessons and retrieves next lesson id', () => {
    const units = buildCurriculum(mockWords, mockSentences);
    const flat = allLessonsFlat(units);

    const found = findLesson(units, flat[0].id);
    expect(found).not.toBeNull();
    expect(found?.lesson.id).toBe(flat[0].id);

    const nextId = nextLessonId(units, flat[0].id);
    expect(nextId).toBe(flat[1].id);

    const finalNextId = nextLessonId(units, flat[1].id);
    expect(finalNextId).toBeNull();
  });

  it('generates sentence build exercises with tiles and bank', () => {
    const exercises = genSentenceBuildExercises(mockSentences);
    expect(exercises.length).toBe(2);

    const first = exercises[0];
    expect(first.type).toBe('sentence-build');
    expect(first.bank).toBeDefined();
    expect(first.bank!.length).toBeGreaterThanOrEqual(3);
  });

  it('generates tone drills with 4 options and valid pinyin answer', () => {
    const cards: VocabCard[] = [
      { id: '1', hanzi: '水', pinyin: 'shuǐ', meaning: 'water', hskLevel: 1 },
      { id: '2', hanzi: '茶', pinyin: 'chá', meaning: 'tea', hskLevel: 1 },
    ];

    const toneEx = genToneDrillExercises(cards);
    expect(toneEx.length).toBe(2);
    expect(toneEx[0].type).toBe('listening-select');
    expect(toneEx[0].options.length).toBe(4);
    expect(toneEx[0].options).toContain(toneEx[0].answer);
  });

  it('generates custom exercises for weak vocabulary words', () => {
    const words: VocabCard[] = [
      { id: '1', hanzi: '水', pinyin: 'shuǐ', meaning: 'water', hskLevel: 1 },
    ];
    const allCards: VocabCard[] = [
      { id: '1', hanzi: '水', pinyin: 'shuǐ', meaning: 'water', hskLevel: 1 },
      { id: '2', hanzi: '茶', pinyin: 'chá', meaning: 'tea', hskLevel: 1 },
      { id: '3', hanzi: '饭', pinyin: 'fàn', meaning: 'meal', hskLevel: 1 },
      { id: '4', hanzi: '喝', pinyin: 'hē', meaning: 'drink', hskLevel: 1 },
    ];

    const ex = genExercisesForVocab(words, allCards);
    expect(ex.length).toBeGreaterThan(0);
    expect(ex.some((e) => e.wordId === '1')).toBe(true);
  });
});
