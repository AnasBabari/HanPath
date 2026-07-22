/**
 * HSK Vocabulary API
 * Fetches Chinese vocabulary from the open-source complete-hsk-vocabulary dataset.
 * Source: https://github.com/drkameleon/complete-hsk-vocabulary
 */

const HSK_BASE =
  'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/inclusive/newest';

export interface HSKWord {
  id: string;
  hanzi: string;
  pinyin: string;
  meanings: string[];
  hskLevel: number;
}

/* ---------- flexible raw-entry parser ---------- */
/*
  The minified JSON from drkameleon/complete-hsk-vocabulary uses:
  s = simplified hanzi
  f = forms array, each form has:
    i = info: { y: pinyin_marks, n: pinyin_numbers, ... }
    m = meanings array
    t = traditional
  We extract the first form's pinyin and meanings.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

function parse(raw: Raw, level: number, i: number): HSKWord | null {
  // Try minified format first (s, f[0].i.y, f[0].m)
  const hanzi = raw.s || raw.simplified || raw.hanzi || raw.word || '';
  if (!hanzi) return null;

  let pinyin = '';
  let m: string[] = [];

  // Minified format: f is an array of forms
  if (Array.isArray(raw.f) && raw.f.length > 0) {
    const form = raw.f[0];
    // Pinyin from form.i.y (marks) or form.i.n (numbers)
    if (form.i) {
      pinyin = form.i.y || form.i.n || '';
    }
    // Meanings from form.m
    if (Array.isArray(form.m)) {
      m = form.m.filter((x: unknown) => typeof x === 'string');
    }
  }

  // Fallback: try full-name keys
  if (!pinyin) {
    if (typeof raw.pinyin === 'string') pinyin = raw.pinyin;
    else if (raw.pinyin?.marks) pinyin = raw.pinyin.marks;
    else if (raw.pinyin_marks) pinyin = raw.pinyin_marks;
  }
  if (!m.length) {
    if (Array.isArray(raw.meanings)) m = raw.meanings;
    else if (typeof raw.meaning === 'string') m = [raw.meaning];
  }

  if (!pinyin || !m.length) return null;
  
  // Custom Override for practical/better meanings
  let finalMeanings = m;
  if (hanzi === '包子') finalMeanings = ['a bun with filling'];
  if (hanzi === '家') finalMeanings = ['home', 'family'];

  return { id: `hsk${level}-${i}`, hanzi, pinyin, meanings: finalMeanings, hskLevel: level };
}

/* ---------- fallbacks ---------- */

const FALLBACK_HSK1: HSKWord[] = [
  { id: 'hsk1-f1', hanzi: '你好', pinyin: 'nǐ hǎo', meanings: ['hello', 'hi'], hskLevel: 1 },
  { id: 'hsk1-f2', hanzi: '谢谢', pinyin: 'xiè xie', meanings: ['thanks', 'thank you'], hskLevel: 1 },
  { id: 'hsk1-f3', hanzi: '不客气', pinyin: 'bù kè qi', meanings: ["you're welcome", "don't be polite"], hskLevel: 1 },
  { id: 'hsk1-f4', hanzi: '再见', pinyin: 'zài jiàn', meanings: ['goodbye', 'see you again'], hskLevel: 1 },
  { id: 'hsk1-f5', hanzi: '对不起', pinyin: 'duì bu qǐ', meanings: ['sorry', 'excuse me'], hskLevel: 1 },
  { id: 'hsk1-f6', hanzi: '没关系', pinyin: 'méi guān xi', meanings: ["it's okay", "it doesn't matter"], hskLevel: 1 },
  { id: 'hsk1-f7', hanzi: '我', pinyin: 'wǒ', meanings: ['I', 'me'], hskLevel: 1 },
  { id: 'hsk1-f8', hanzi: '你', pinyin: 'nǐ', meanings: ['you'], hskLevel: 1 },
  { id: 'hsk1-f9', hanzi: '他', pinyin: 'tā', meanings: ['he', 'him'], hskLevel: 1 },
  { id: 'hsk1-f10', hanzi: '她', pinyin: 'tā', meanings: ['she', 'her'], hskLevel: 1 },
  { id: 'hsk1-f11', hanzi: '们', pinyin: 'men', meanings: ['(plural marker for people)'], hskLevel: 1 },
  { id: 'hsk1-f12', hanzi: '是', pinyin: 'shì', meanings: ['is', 'are', 'am', 'yes'], hskLevel: 1 },
  { id: 'hsk1-f13', hanzi: '不', pinyin: 'bù', meanings: ['no', 'not'], hskLevel: 1 },
  { id: 'hsk1-f14', hanzi: '喝', pinyin: 'hē', meanings: ['to drink'], hskLevel: 1 },
  { id: 'hsk1-f15', hanzi: '吃', pinyin: 'chī', meanings: ['to eat'], hskLevel: 1 },
  { id: 'hsk1-f16', hanzi: '水', pinyin: 'shuǐ', meanings: ['water'], hskLevel: 1 },
  { id: 'hsk1-f17', hanzi: '饭', pinyin: 'fàn', meanings: ['meal', 'cooked rice'], hskLevel: 1 },
  { id: 'hsk1-f18', hanzi: '茶', pinyin: 'chá', meanings: ['tea'], hskLevel: 1 },
  { id: 'hsk1-f19', hanzi: '咖啡', pinyin: 'kā fēi', meanings: ['coffee'], hskLevel: 1 },
  { id: 'hsk1-f20', hanzi: '什么', pinyin: 'shén me', meanings: ['what'], hskLevel: 1 },
];

/* ---------- cache ---------- */

const mem = new Map<number, HSKWord[]>();

export async function fetchHSKLevel(level: number): Promise<HSKWord[]> {
  if (mem.has(level)) return mem.get(level)!;

  const key = `hanpath-hsk-v2-${level}`;
  try {
    const s = localStorage.getItem(key);
    if (s) {
      const w = JSON.parse(s) as HSKWord[];
      if (Array.isArray(w) && w.length) { mem.set(level, w); return w; }
    }
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  try {
    const r = await fetch(`${HSK_BASE}/${level}.min.json`);
    if (!r.ok) {
      if (r.status === 429 && level === 1) return FALLBACK_HSK1;
      throw new Error(`HSK ${level} fetch failed (${r.status})`);
    }

    const data: Raw[] = await r.json();
    const words = data.map((d, i) => parse(d, level, i)).filter(Boolean) as HSKWord[];

    mem.set(level, words);
    try {
      localStorage.setItem(key, JSON.stringify(words));
    } catch {
      // Clear older levels if QuotaExceededError
      clearVocabCache();
      try { localStorage.setItem(key, JSON.stringify(words)); } catch { /* storage full */ }
    }
    return words;
  } catch (e) {
    if (level === 1) {
      console.warn('Using local HSK 1 fallback data');
      return FALLBACK_HSK1;
    }
    throw e;
  }
}

export function clearVocabCache() {
  mem.clear();
  for (let i = 1; i <= 7; i++) {
    try { localStorage.removeItem(`hanpath-hsk-v2-${i}`); } catch { /* ok */ }
  }
}

/* ---------- Sentences API ---------- */

export interface HSKSentence {
  id: number;
  hsk: number;
  zh: string;
  en: string;
  py: string;
  tiles: string[];
  required_words: string[];
}

const FALLBACK_SENTENCES: HSKSentence[] = [
  { id: 1, hsk: 1, zh: '我是学生', en: 'I am a student', py: 'wǒ shì xué shēng', tiles: ['我', '是', '学生'], required_words: ['我', '是', '学生'] },
  { id: 2, hsk: 1, zh: '她喝水', en: 'She drinks water', py: 'tā hē shuǐ', tiles: ['她', '喝', '水'], required_words: ['她', '喝', '水'] },
  { id: 3, hsk: 1, zh: '我有书', en: 'I have a book', py: 'wǒ yǒu shū', tiles: ['我', '有', '书'], required_words: ['我', '有', '书'] },
  { id: 4, hsk: 1, zh: '他是老师', en: 'He is a teacher', py: 'tā shì lǎoshī', tiles: ['他', '是', '老师'], required_words: ['他', '是', '老师'] },
  { id: 5, hsk: 1, zh: '我在家', en: 'I am at home', py: 'wǒ zài jiā', tiles: ['我', '在', '家'], required_words: ['我', '在', '家'] },
  { id: 6, hsk: 1, zh: '我不喝茶', en: "I don't drink tea", py: 'wǒ bù hē chá', tiles: ['我', '不', '喝', '茶'], required_words: ['我', '不', '喝', '茶'] },
  { id: 7, hsk: 1, zh: '那是什么', en: 'What is that?', py: 'nà shì shénme', tiles: ['那', '是', '什么'], required_words: ['那', '是', '什么'] },
  { id: 8, hsk: 1, zh: '我去学校', en: 'I go to school', py: 'wǒ qù xuéxiào', tiles: ['我', '去', '学校'], required_words: ['我', '去', '学校'] },
  { id: 9, hsk: 1, zh: '你好吗', en: 'How are you?', py: 'nǐ hǎo ma', tiles: ['你', '好', '吗'], required_words: ['你', '好', '吗'] },
  { id: 10, hsk: 1, zh: '我喝咖啡', en: 'I drink coffee', py: 'wǒ hē kāfēi', tiles: ['我', '喝', '咖啡'], required_words: ['我', '喝', '咖啡'] },
  { id: 11, hsk: 1, zh: '他们是朋友', en: 'They are friends', py: 'tāmen shì péngyǒu', tiles: ['他们', '是', '朋友'], required_words: ['他们', '是', '朋友'] },
  { id: 12, hsk: 1, zh: '我不是老师', en: 'I am not a teacher', py: 'wǒ bùshì lǎoshī', tiles: ['我', '不是', '老师'], required_words: ['我', '不是', '老师'] }
];

const sentenceCache = new Map<number, HSKSentence[]>();

export async function fetchSentences(hskLevel: number = 1): Promise<HSKSentence[]> {
  if (sentenceCache.has(hskLevel)) return sentenceCache.get(hskLevel)!;

  try {
    const res = await fetch(`/data/hsk${hskLevel}_sentences.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: HSKSentence[] = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      sentenceCache.set(hskLevel, data);
      return data;
    }
  } catch (err) {
    console.warn(`Could not load sentences for HSK ${hskLevel}, using fallback:`, err);
  }

  sentenceCache.set(hskLevel, FALLBACK_SENTENCES);
  return FALLBACK_SENTENCES;
}

