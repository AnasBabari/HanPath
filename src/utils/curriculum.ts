/**
 * Dynamic Curriculum Builder
 * Converts HSK API vocabulary into structured units → lessons → exercises.
 * Heavy emphasis on reading and listening exercises for beginners.
 */

import type { HSKWord, VocabCard, Exercise, Lesson, Unit } from '../types';

/* ---- Config ---- */

const WORDS_PER_LESSON = 4;
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

/**
 * Cleans a raw meaning into a short, practical, easy-to-remember definition.
 * "to love; to be fond of; to like" → "to love"
 * "(coll.) father; dad" → "father"
 * "bar (loanword) (serving drinks...)" → "bar"
 */
function cleanMeaning(raw: string[]): string {
  // Pick the shortest, most practical meaning
  const candidates = raw
    .flatMap(m => m.split(';'))
    .map(m => m.trim())
    .filter(m => m.length > 0)
    // Remove parenthetical-only entries like "(sth)"
    .filter(m => !/^\(.*\)$/.test(m))
    // Strip leading parentheticals: "(coll.) father" → "father"
    .map(m => m.replace(/^\([^)]*\)\s*/g, '').trim())
    // Strip trailing parentheticals: "bar (loanword)" → "bar"
    .map(m => m.replace(/\s*\([^)]*\)\s*$/g, '').trim())
    .filter(m => m.length > 0);

  if (!candidates.length) return raw[0] || '';

  // Prefer short entries (< 20 chars), otherwise take first
  const short = candidates.filter(c => c.length <= 20);
  return (short.length ? short[0] : candidates[0]);
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

/* ---- Exercise generation ---- */

function genExercises(words: VocabCard[], allCards: VocabCard[], lessonId: string): Exercise[] {
  const allM = allCards.map(c => c.meaning);
  const allH = allCards.map(c => c.hanzi);
  const ex: Exercise[] = [];
  let n = 0;

  // Build a pinyin lookup for hanzi options
  const pinyinMap = new Map(allCards.map(c => [c.hanzi, c.pinyin]));

  for (const w of words) {
    // 1. Reading: hanzi → meaning (core reading skill)
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'reading-meaning',
      prompt: w.hanzi, promptPinyin: w.pinyin,
      hint: 'What does this mean?',
      options: shuffle([w.meaning, ...pick(allM, 3, w.meaning)]),
      answer: w.meaning,
    });

    // 2. Listening: hear → pick hanzi (core listening skill)
    const listenHanziOpts = shuffle([w.hanzi, ...pick(allH, 3, w.hanzi)]);
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'listening-select',
      prompt: 'Listen and select',
      promptAudio: w.hanzi,
      options: listenHanziOpts,
      optionsPinyin: listenHanziOpts.map(h => pinyinMap.get(h) || ''),
      answer: w.hanzi,
    });
  }

  // 3. One reading-hanzi (meaning → hanzi) for half the words
  for (const w of shuffle(words).slice(0, Math.ceil(words.length / 2))) {
    const opts = shuffle([w.hanzi, ...pick(allH, 3, w.hanzi)]);
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'reading-hanzi',
      prompt: w.meaning, hint: 'Choose the correct characters',
      options: opts,
      optionsPinyin: opts.map(h => pinyinMap.get(h) || ''),
      answer: w.hanzi,
    });
  }

  // 4. One pinyin typing exercise
  const pWord = shuffle(words)[0];
  if (pWord) {
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'pinyin-type',
      prompt: pWord.hanzi, hint: 'Type the pinyin',
      options: [], answer: pWord.pinyin,
    });
  }

  // 5. One compose for a multi-char word (if any)
  const composeWord = words.find(w => w.hanzi.length >= 2);
  if (composeWord) {
    const chars = composeWord.hanzi.split('');
    const extras = shuffle(
      allCards.filter(c => c.hanzi !== composeWord.hanzi)
        .flatMap(c => c.hanzi.split(''))
        .filter(c => !chars.includes(c))
    ).slice(0, 2);
    ex.push({
      id: `${lessonId}-e${n++}`, type: 'compose',
      prompt: composeWord.meaning, hint: composeWord.pinyin,
      options: [], answer: composeWord.hanzi, bank: shuffle([...chars, ...extras]),
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
