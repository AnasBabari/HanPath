/**
 * Dynamic Curriculum Builder
 * Converts HSK API vocabulary into structured units → lessons → exercises.
 * Heavy emphasis on reading and listening exercises for beginners.
 */

import type { HSKWord } from './api';

/* ---- Types ---- */

export type ExerciseType =
  | 'reading-meaning'   // See hanzi → pick English meaning
  | 'reading-hanzi'     // See English → pick correct hanzi
  | 'listening-select'  // Hear word → pick correct hanzi
  | 'listening-meaning' // Hear word → pick English meaning
  | 'pinyin-type'       // See hanzi → type pinyin
  | 'compose';          // Build word from character tiles

export interface VocabCard {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  hskLevel: number;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  prompt: string;
  promptAudio?: string;
  hint?: string;
  options: string[];
  answer: string;
  bank?: string[];
}

export interface Lesson {
  id: string;
  unitId: string;
  index: number;
  title: string;
  summary: string;
  vocab: VocabCard[];
  exercises: Exercise[];
}

export interface Unit {
  id: string;
  hskLevel: number;
  index: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

/* ---- Config ---- */

const WORDS_PER_LESSON = 6;
const LESSONS_PER_UNIT = 5;

const UNIT_NAMES = [
  'Foundation', 'Core Basics', 'First Words', 'Building Blocks', 'Growing',
  'Expanding', 'Connecting', 'Deepening', 'Broadening', 'Exploring',
  'Discovering', 'Understanding', 'Progressing', 'Advancing', 'Developing',
  'Strengthening', 'Mastering', 'Perfecting', 'Reaching', 'Shining',
];

/* ---- Helpers ---- */

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pick<T>(arr: T[], n: number, exclude?: T): T[] {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : [...arr];
  return shuffle(pool).slice(0, n);
}

function toCard(w: HSKWord): VocabCard {
  return {
    id: w.id,
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    meaning: w.meanings.slice(0, 2).join('; '),
    hskLevel: w.hskLevel,
  };
}

/* ---- Exercise generation ---- */

function genExercises(words: VocabCard[], allCards: VocabCard[], lessonId: string): Exercise[] {
  const allM = allCards.map(c => c.meaning);
  const allH = allCards.map(c => c.hanzi);
  const ex: Exercise[] = [];
  let n = 0;

  for (const w of words) {
    // Reading: hanzi → meaning  (most important for reading)
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'reading-meaning',
      prompt: w.hanzi, hint: 'What does this mean?',
      options: shuffle([w.meaning, ...pick(allM, 3, w.meaning)]),
      answer: w.meaning,
    });

    // Reading: meaning → hanzi
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'reading-hanzi',
      prompt: w.meaning, hint: 'Choose the correct characters',
      options: shuffle([w.hanzi, ...pick(allH, 3, w.hanzi)]),
      answer: w.hanzi,
    });

    // Listening: hear → pick hanzi
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'listening-select',
      prompt: 'Listen and select the correct characters',
      promptAudio: w.hanzi,
      options: shuffle([w.hanzi, ...pick(allH, 3, w.hanzi)]),
      answer: w.hanzi,
    });

    // Listening: hear → pick meaning
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'listening-meaning',
      prompt: 'What does this word mean?',
      promptAudio: w.hanzi,
      options: shuffle([w.meaning, ...pick(allM, 3, w.meaning)]),
      answer: w.meaning,
    });
  }

  // Pinyin typing for half the words
  for (const w of shuffle(words).slice(0, Math.ceil(words.length / 2))) {
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'pinyin-type',
      prompt: w.hanzi, hint: 'Type the pinyin',
      options: [], answer: w.pinyin,
    });
  }

  // Compose for multi-char words
  for (const w of words.filter(w => w.hanzi.length >= 2).slice(0, 2)) {
    const chars = w.hanzi.split('');
    const extras = shuffle(
      allCards.filter(c => c.hanzi !== w.hanzi).flatMap(c => c.hanzi.split('')).filter(c => !chars.includes(c))
    ).slice(0, 2);
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'compose',
      prompt: w.meaning, hint: w.pinyin,
      options: [], answer: w.hanzi, bank: shuffle([...chars, ...extras]),
    });
  }

  // Order: reading-meaning first (gentle intro), then shuffle rest
  const first = ex.filter(e => e.type === 'reading-meaning');
  const rest = shuffle(ex.filter(e => e.type !== 'reading-meaning'));
  return [...first, ...rest];
}

/* ---- Build curriculum from API words ---- */

export function buildCurriculum(words: HSKWord[]): Unit[] {
  const cards = words.map(toCard);
  const units: Unit[] = [];

  // Split into lessons
  const lessonGroups: VocabCard[][] = [];
  for (let i = 0; i < cards.length; i += WORDS_PER_LESSON) {
    lessonGroups.push(cards.slice(i, i + WORDS_PER_LESSON));
  }

  // Group lessons into units
  let ui = 0;
  for (let i = 0; i < lessonGroups.length; i += LESSONS_PER_UNIT) {
    const groups = lessonGroups.slice(i, i + LESSONS_PER_UNIT);
    const hsk = cards[0]?.hskLevel || 1;
    const uid = `hsk${hsk}-u${ui}`;

    const lessons: Lesson[] = groups.map((lw, li) => {
      const lid = `${uid}-l${li}`;
      return {
        id: lid, unitId: uid, index: li,
        title: `Lesson ${i + li + 1}`,
        summary: lw.map(w => w.hanzi).join(' · '),
        vocab: lw,
        exercises: genExercises(lw, cards, lid),
      };
    });

    units.push({
      id: uid, hskLevel: hsk, index: ui,
      title: `Unit ${ui + 1}: ${UNIT_NAMES[ui % UNIT_NAMES.length]}`,
      description: `${lessons.reduce((s, l) => s + l.vocab.length, 0)} words · ${lessons.length} lessons`,
      lessons,
    });
    ui++;
  }

  return units;
}

/* ---- Utilities ---- */

export function allLessonsFlat(units: Unit[]): Lesson[] {
  return units.flatMap(u => u.lessons);
}

export function findLesson(units: Unit[], id: string): { unit: Unit; lesson: Lesson } | null {
  for (const u of units) {
    const l = u.lessons.find(l => l.id === id);
    if (l) return { unit: u, lesson: l };
  }
  return null;
}

export function nextLessonId(units: Unit[], after: string): string | null {
  const flat = allLessonsFlat(units);
  const i = flat.findIndex(l => l.id === after);
  return i >= 0 && i + 1 < flat.length ? flat[i + 1].id : null;
}

export function isLessonUnlocked(id: string, units: Unit[], done: string[]): boolean {
  const flat = allLessonsFlat(units);
  const i = flat.findIndex(l => l.id === id);
  if (i <= 0) return true; // first lesson always unlocked
  return done.includes(flat[i - 1].id);
}
