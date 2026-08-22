/**
 * Deterministic HSK 3.0 Curriculum Engine
 * Constructs 5 vocabulary lessons (10 words each) + 1 checkpoint lesson per unit.
 * Offline-first and pure.
 */

import type { HSKWord, VocabCard, Exercise, Lesson, Unit } from '../types';
import type { HSKSentence } from './api';

const WORDS_PER_LESSON = 10;
const VOCAB_LESSONS_PER_UNIT = 5;

const UNIT_NAMES = [
  'Foundation',
  'Core Basics',
  'First Words',
  'Building Blocks',
  'Growing',
  'Expanding',
  'Connecting',
  'Deepening',
  'Broadening',
  'Exploring',
  'Discovering',
  'Understanding',
  'Progressing',
  'Advancing',
  'Developing',
  'Strengthening',
  'Mastering',
  'Perfecting',
  'Reaching',
  'Shining',
];

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pick<T>(arr: T[], n: number, exclude?: T): T[] {
  const pool = exclude !== undefined ? arr.filter((x) => x !== exclude) : [...arr];
  return shuffle(pool).slice(0, n);
}

function cleanMeaning(raw: string[]): string {
  const candidates: string[] = [];
  for (const item of raw) {
    for (const sub of item.split(';')) {
      const trimmed = sub.trim();
      if (!trimmed || /^\(.*\)$/.test(trimmed)) continue;
      const cleaned = trimmed.replace(/^\([^)]*\)\s*/g, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
      if (cleaned) candidates.push(cleaned);
    }
  }

  if (!candidates.length) return raw[0] || '';
  const short = candidates.find((c) => c.length <= 25);
  return short || candidates[0];
}

function toCard(w: HSKWord): VocabCard {
  return {
    id: w.id,
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    meaning: cleanMeaning(w.meanings),
    hskLevel: w.hskLevel,
  };
}

function genExercises(
  vocab: VocabCard[],
  allPool: VocabCard[],
  lessonId: string,
  extraSentenceBuilds: Exercise[] = []
): Exercise[] {
  const exercises: Exercise[] = [];

  for (let i = 0; i < vocab.length; i++) {
    const v = vocab[i];
    const eid = `${lessonId}-e${i}`;

    // Exercise 1: Reading Meaning (Multiple choice: English meaning)
    const distractorMeanings = pick(
      allPool.map((w) => w.meaning),
      3,
      v.meaning
    );
    const meaningOptions = shuffle([v.meaning, ...distractorMeanings]);

    exercises.push({
      id: `${eid}-meaning`,
      wordId: v.id,
      type: 'reading-meaning',
      prompt: v.hanzi,
      promptPinyin: v.pinyin,
      hint: `Pinyin: ${v.pinyin}`,
      options: meaningOptions,
      answer: v.meaning,
    });

    // Exercise 2: Reading Hanzi (Given English, choose Hanzi)
    const distractorHanzi = pick(
      allPool.map((w) => w.hanzi),
      3,
      v.hanzi
    );
    const hanziOptions = shuffle([v.hanzi, ...distractorHanzi]);
    const hanziOptionsPinyin = hanziOptions.map((h) => allPool.find((x) => x.hanzi === h)?.pinyin || '');

    exercises.push({
      id: `${eid}-hanzi`,
      wordId: v.id,
      type: 'reading-hanzi',
      prompt: `Select the character for "${v.meaning}"`,
      promptPinyin: v.pinyin,
      hint: `Pronunciation: ${v.pinyin}`,
      options: hanziOptions,
      optionsPinyin: hanziOptionsPinyin,
      answer: v.hanzi,
    });

    // Exercise 3: Listening Meaning (Audio prompt, select English meaning)
    exercises.push({
      id: `${eid}-listen`,
      wordId: v.id,
      type: 'listening-meaning',
      prompt: 'Listen and select the correct meaning',
      promptAudio: v.hanzi,
      options: meaningOptions,
      answer: v.meaning,
    });
  }

  // Interleave extra sentence builds
  if (extraSentenceBuilds.length > 0) {
    exercises.push(...extraSentenceBuilds);
  }

  return shuffle(exercises);
}

function createSentenceBuildExercises(
  sentences: HSKSentence[],
  prefix: string,
  distractorPool: string[] = []
): Exercise[] {
  const allTiles = Array.from(new Set([...sentences.flatMap((s) => s.tiles), ...distractorPool]));

  return sentences.map((s, i) => {
    const distractors = shuffle(allTiles.filter((t) => !s.tiles.includes(t))).slice(0, 3);
    return {
      id: `${prefix}-${i}`,
      type: 'sentence-build',
      prompt: s.en,
      hint: s.py,
      answer: s.zh,
      options: [],
      bank: shuffle([...s.tiles, ...distractors]),
    };
  });
}

/**
 * Builds deterministic structured curriculum units for target HSK level
 */
export function buildCurriculum(
  words: HSKWord[],
  rawSentences: HSKSentence[] = []
): Unit[] {
  const cards = words.map(toCard);
  const units: Unit[] = [];
  if (cards.length === 0) return units;

  const hsk = cards[0]?.hskLevel || 1;

  // Group cards into 10-word lesson chunks
  const vocabChunks: VocabCard[][] = [];
  for (let i = 0; i < cards.length; i += WORDS_PER_LESSON) {
    vocabChunks.push(cards.slice(i, i + WORDS_PER_LESSON));
  }

  let unitIndex = 0;
  for (let i = 0; i < vocabChunks.length; i += VOCAB_LESSONS_PER_UNIT) {
    const unitVocabGroups = vocabChunks.slice(i, i + VOCAB_LESSONS_PER_UNIT);
    const uid = `hsk${hsk}-u${unitIndex}`;
    const allUnitWords = unitVocabGroups.flat();

    // 5 Vocabulary Lessons
    const lessons: Lesson[] = unitVocabGroups.map((lw, li) => {
      const lid = `${uid}-l${li}`;
      const lessonWordHanzi = lw.map((w) => w.hanzi);

      let extraSentences: Exercise[] = [];
      if (rawSentences.length > 0) {
        const matchingSentences = rawSentences.filter((s) =>
          s.required_words.some((rw) => lessonWordHanzi.includes(rw))
        );
        if (matchingSentences.length > 0) {
          extraSentences = createSentenceBuildExercises(
            pick(matchingSentences, 1),
            `${lid}-sent`,
            lessonWordHanzi
          );
        }
      }

      return {
        id: lid,
        unitId: uid,
        index: li,
        title: `Lesson ${li + 1}`,
        summary: lw.map((w) => w.hanzi).slice(0, 4).join(', ') + '...',
        vocab: lw,
        exercises: genExercises(lw, cards, lid, extraSentences),
      };
    });

    // 1 Checkpoint Review Lesson per Unit
    const checkpointId = `${uid}-checkpoint`;
    const checkpointExercises = shuffle([
      ...allUnitWords.slice(0, 10).map((v, idx) => ({
        id: `${checkpointId}-c${idx}`,
        wordId: v.id,
        type: 'reading-meaning' as const,
        prompt: v.hanzi,
        promptPinyin: v.pinyin,
        hint: v.pinyin,
        options: shuffle([v.meaning, ...pick(cards.map((c) => c.meaning), 3, v.meaning)]),
        answer: v.meaning,
      })),
      ...createSentenceBuildExercises(
        pick(rawSentences.length > 0 ? rawSentences : [], 2),
        `${checkpointId}-boss`,
        allUnitWords.map((w) => w.hanzi)
      ),
    ]);

    lessons.push({
      id: checkpointId,
      unitId: uid,
      index: VOCAB_LESSONS_PER_UNIT,
      title: 'Unit Checkpoint',
      summary: 'Cumulative unit review & challenge',
      vocab: allUnitWords,
      exercises: checkpointExercises,
    });

    units.push({
      id: uid,
      hskLevel: hsk,
      index: unitIndex,
      title: `Unit ${unitIndex + 1}: ${UNIT_NAMES[unitIndex % UNIT_NAMES.length]}`,
      description: `${allUnitWords.length} words · 5 lessons + 1 checkpoint`,
      lessons,
    });

    unitIndex++;
  }

  return units;
}

export function allLessonsFlat(units: Unit[]): Lesson[] {
  return units.flatMap((u) => u.lessons);
}

export function findLesson(units: Unit[], id: string): { unit: Unit; lesson: Lesson } | null {
  for (const u of units) {
    const l = u.lessons.find((l) => l.id === id);
    if (l) return { unit: u, lesson: l };
  }
  return null;
}

export function nextLessonId(units: Unit[], currentId: string): string | null {
  const flat = allLessonsFlat(units);
  const idx = flat.findIndex((l) => l.id === currentId);
  if (idx >= 0 && idx < flat.length - 1) {
    return flat[idx + 1].id;
  }
  return null;
}

export function isLessonUnlocked(
  lessonId: string,
  completedLessons: string[],
  units: Unit[]
): boolean {
  const flat = allLessonsFlat(units);
  const idx = flat.findIndex((l) => l.id === lessonId);
  if (idx <= 0) return true; // First lesson is always unlocked
  const prevLesson = flat[idx - 1];
  return completedLessons.includes(prevLesson.id);
}
