/**
 * Dynamic Curriculum Builder
 * Converts HSK API vocabulary and Hugging Face sentence dataset into structured units → lessons → exercises.
 * Phased progression:
 * - Units 1-2: Pure vocabulary & stroke order foundation
 * - Units 3-5: Vocab lessons + Unit Boss sentence assembly
 * - Units 6+: Comprehensive immersion with integrated sentence building
 */

import type { HSKWord, VocabCard, Exercise, Lesson, Unit } from '../types';
import type { HSKSentence } from './api';

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

function cleanMeaning(raw: string[]): string {
  const candidates = raw
    .flatMap(m => m.split(';'))
    .map(m => m.trim())
    .filter(m => m.length > 0)
    .filter(m => !/^\(.*\)$/.test(m))
    .map(m => m.replace(/^\([^)]*\)\s*/g, '').trim())
    .map(m => m.replace(/\s*\([^)]*\)\s*$/g, '').trim())
    .filter(m => m.length > 0);

  if (!candidates.length) return raw[0] || '';
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

/* ---- Sentence Filtering (i+1 Hybrid Mode) ---- */

function filterSentencesForLesson(
  sentences: HSKSentence[],
  knownWordsSet: Set<string>,
  currentLessonWords: string[]
): HSKSentence[] {
  const activePool = new Set([...knownWordsSet, ...currentLessonWords]);

  const matches = sentences.filter(s => {
    let unknownCount = 0;
    for (const req of s.required_words) {
      if (!activePool.has(req)) {
        unknownCount++;
        if (unknownCount > 1) return false; // Allow at most 1 unknown word (+1 hypothesis)
      }
    }
    return true;
  });

  return matches;
}

/* ---- Exercise generation ---- */

function genExercises(
  words: VocabCard[],
  allCards: VocabCard[],
  lessonId: string,
  extraSentenceBuilds: Exercise[] = []
): Exercise[] {
  const allM = allCards.map(c => c.meaning);
  const allH = allCards.map(c => c.hanzi);
  const ex: Exercise[] = [];
  let n = 0;

  const pinyinMap = new Map(allCards.map(c => [c.hanzi, c.pinyin]));

  for (const w of words) {
    ex.push({
      id: `${lessonId}-e${n++}`, wordId: w.id, type: 'reading-meaning',
      prompt: w.hanzi, promptPinyin: w.pinyin,
      hint: 'What does this mean?',
      options: shuffle([w.meaning, ...pick(allM, 3, w.meaning)]),
      answer: w.meaning,
    });

    const listenHanziOpts = shuffle([w.hanzi, ...pick(allH, 3, w.hanzi)]);
    ex.push({
      id: `${lessonId}-e${n++}`, wordId: w.id, type: 'listening-select',
      prompt: 'Listen and select',
      promptAudio: w.hanzi,
      options: listenHanziOpts,
      optionsPinyin: listenHanziOpts.map(h => pinyinMap.get(h) || ''),
      answer: w.hanzi,
    });
  }

  for (const w of shuffle(words).slice(0, Math.ceil(words.length / 2))) {
    const opts = shuffle([w.hanzi, ...pick(allH, 3, w.hanzi)]);
    ex.push({
      id: `${lessonId}-e${n++}`, wordId: w.id, type: 'reading-hanzi',
      prompt: w.meaning, hint: 'Choose the correct characters',
      options: opts,
      optionsPinyin: opts.map(h => pinyinMap.get(h) || ''),
      answer: w.hanzi,
    });
  }

  const pWord = shuffle(words)[0];
  if (pWord) {
    ex.push({
      id: `${lessonId}-e${n++}`, wordId: pWord.id, type: 'pinyin-type',
      prompt: pWord.hanzi, hint: 'Type the pinyin',
      options: [], answer: pWord.pinyin,
    });
  }

  const composeWord = words.find(w => w.hanzi.length >= 2);
  if (composeWord) {
    const chars = composeWord.hanzi.split('');
    const extras = shuffle(
      allCards.filter(c => c.hanzi !== composeWord.hanzi)
        .flatMap(c => c.hanzi.split(''))
        .filter(c => !chars.includes(c))
    ).slice(0, 2);
    ex.push({
      id: `${lessonId}-e${n++}`, wordId: composeWord.id, type: 'compose',
      prompt: composeWord.meaning, hint: composeWord.pinyin,
      options: [], answer: composeWord.hanzi, bank: shuffle([...chars, ...extras]),
    });
  }

  const strokeWord = shuffle(words.filter(w => w.hanzi.length === 1))[0];
  if (strokeWord) {
    ex.push({
      id: `${lessonId}-e${n++}`, wordId: strokeWord.id, type: 'stroke-order',
      prompt: strokeWord.meaning, hint: strokeWord.pinyin,
      options: [], answer: strokeWord.hanzi,
    });
  }

  const first = ex.filter(e => e.type === 'reading-meaning');
  const rest = shuffle(ex.filter(e => e.type !== 'reading-meaning'));

  return [...first, ...rest, ...extraSentenceBuilds];
}

/* ---- Build curriculum from API words & sentences ---- */

export function buildCurriculum(words: HSKWord[], rawSentences: HSKSentence[] = []): Unit[] {
  const cards = words.map(toCard);
  const units: Unit[] = [];

  const PRACTICAL = ['你好', '再见', '谢谢', '不客气', '对不起', '没关系', '是', '不', '我', '你', '他', '她', '们', '喝', '吃', '水', '饭', '茶', '咖啡', '学生', '老师', '家', '学校', '去', '在', '什么', '哪', '谁', '多', '少'];

  const prioritizedCards = [
    ...cards.filter(c => PRACTICAL.includes(c.hanzi)),
    ...cards.filter(c => !PRACTICAL.includes(c.hanzi))
  ];

  const lessonGroups: VocabCard[][] = [];
  for (let i = 0; i < prioritizedCards.length; i += WORDS_PER_LESSON) {
    lessonGroups.push(prioritizedCards.slice(i, i + WORDS_PER_LESSON));
  }

  const knownWordsSet = new Set<string>();
  let ui = 0;

  for (let i = 0; i < lessonGroups.length; i += LESSONS_PER_UNIT) {
    const groups = lessonGroups.slice(i, i + LESSONS_PER_UNIT);
    const hsk = cards[0]?.hskLevel || 1;
    const uid = `hsk${hsk}-u${ui}`;

    const lessons: Lesson[] = groups.map((lw, li) => {
      const lid = `${uid}-l${li}`;
      const lessonWordHanzi = lw.map(w => w.hanzi);
      const isBossLesson = li === LESSONS_PER_UNIT - 1;

      let extraSentenceBuilds: Exercise[] = [];

      if (rawSentences.length > 0) {
        const suitableSentences = filterSentencesForLesson(rawSentences, knownWordsSet, lessonWordHanzi);
        
        // Phase 2 (Units 3-5): Lesson 5 is a Unit Boss sentence test
        if (ui >= 2 && ui < 5 && isBossLesson) {
          const bossSentences = pick(suitableSentences, 4);
          extraSentenceBuilds = createSentenceBuildExercises(bossSentences, `${lid}-boss`);
        }
        // Phase 3 (Units 6+): Every lesson includes 1-2 sentence builds at the end
        else if (ui >= 5) {
          const endSentences = pick(suitableSentences, 2);
          extraSentenceBuilds = createSentenceBuildExercises(endSentences, `${lid}-sent`);
        }
      }

      // Add words to cumulative known set
      lessonWordHanzi.forEach(w => knownWordsSet.add(w));

      return {
        id: lid, unitId: uid, index: li,
        title: `Lesson ${i + li + 1}`,
        summary: '???',
        vocab: lw,
        exercises: genExercises(lw, prioritizedCards, lid, extraSentenceBuilds),
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

function createSentenceBuildExercises(sentences: HSKSentence[], prefix: string): Exercise[] {
  const allTiles = Array.from(new Set(sentences.flatMap(s => s.tiles)));

  return sentences.map((s, i) => {
    const distractors = shuffle(allTiles.filter(t => !s.tiles.includes(t))).slice(0, 3);
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
  if (i <= 0) return true;
  return done.includes(flat[i - 1].id);
}

export function genExercisesForVocab(words: VocabCard[], allCards: VocabCard[]): Exercise[] {
  const padded = allCards.length < 4 ? [...allCards, ...words, ...words] : allCards;
  return genExercises(words, padded, 'drill-session');
}

export function genSentenceBuildExercises(sentences: HSKSentence[] = []): Exercise[] {
  const pool = sentences.length > 0 ? pick(sentences, 10) : [];
  if (pool.length === 0) return [];
  return createSentenceBuildExercises(pool, 'sent-drill');
}

const TONES = [
  ['ā','á','ǎ','à','a'],
  ['ē','é','ě','è','e'],
  ['ī','í','ǐ','ì','i'],
  ['ō','ó','ǒ','ò','o'],
  ['ū','ú','ǔ','ù','u'],
  ['ǖ','ǘ','ǚ','ǜ','ü']
];

function generateToneDistractors(correctPinyin: string): string[] {
  const distractors = new Set<string>();
  distractors.add(correctPinyin);

  let attempts = 0;
  while (distractors.size < 4 && attempts < 100) {
    attempts++;
    let fakePinyin = correctPinyin;
    for (const group of TONES) {
      for (const char of group) {
        if (fakePinyin.includes(char)) {
          const fakeChar = group[Math.floor(Math.random() * group.length)];
          fakePinyin = fakePinyin.replace(char, fakeChar);
        }
      }
    }
    distractors.add(fakePinyin);
  }

  const fallback = ['mā ma', 'bà ba', 'hěn hǎo', 'bù shì'];
  while(distractors.size < 4) {
    distractors.add(fallback[Math.floor(Math.random() * fallback.length)]);
  }

  return shuffle(Array.from(distractors)).slice(0, 4);
}

export function genToneDrillExercises(vocab: VocabCard[]): Exercise[] {
  if (vocab.length === 0) return [];
  const pool = pick(vocab, 15);
  return pool.map((w, i) => {
    return {
      id: `tone-${i}`,
      wordId: w.id,
      type: 'listening-select',
      prompt: 'Listen and pick the correct tones',
      promptAudio: w.hanzi,
      answer: w.pinyin,
      options: generateToneDistractors(w.pinyin),
    };
  });
}
