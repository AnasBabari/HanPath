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

  return { id: `hsk${level}-${i}`, hanzi, pinyin, meanings: finalMeanings, hskLevel: level };
}

/* ---------- cache ---------- */

const mem = new Map<number, HSKWord[]>();

export async function fetchHSKLevel(level: number): Promise<HSKWord[]> {
  if (mem.has(level)) return mem.get(level)!;

  const key = `hanpath-hsk-v2-${level}`;
  try {
    const s = localStorage.getItem(key);
    if (s) {
      const w = JSON.parse(s) as HSKWord[];
      if (w.length) { mem.set(level, w); return w; }
    }
  } catch { /* ignore */ }

  const r = await fetch(`${HSK_BASE}/${level}.min.json`);
  if (!r.ok) throw new Error(`HSK ${level} fetch failed (${r.status})`);

  const data: Raw[] = await r.json();
  const words = data.map((d, i) => parse(d, level, i)).filter(Boolean) as HSKWord[];

  mem.set(level, words);
  try { localStorage.setItem(key, JSON.stringify(words)); } catch { /* full */ }
  return words;
}

export function clearVocabCache() {
  mem.clear();
  for (let i = 1; i <= 7; i++) {
    try { localStorage.removeItem(`hanpath-hsk-v2-${i}`); } catch { /* ok */ }
  }
}
