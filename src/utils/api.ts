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

const FALLBACK_HSK2: HSKWord[] = [
  { id: 'hsk2-f1', hanzi: '帮助', pinyin: 'bāng zhù', meanings: ['to help', 'assistance'], hskLevel: 2 },
  { id: 'hsk2-f2', hanzi: '准备', pinyin: 'zhǔn bèi', meanings: ['to prepare', 'get ready'], hskLevel: 2 },
  { id: 'hsk2-f3', hanzi: '希望', pinyin: 'xī wàng', meanings: ['to hope', 'wish'], hskLevel: 2 },
  { id: 'hsk2-f4', hanzi: '跑步', pinyin: 'pǎo bù', meanings: ['to run', 'jog'], hskLevel: 2 },
  { id: 'hsk2-f5', hanzi: '游泳', pinyin: 'yóu yǒng', meanings: ['to swim'], hskLevel: 2 },
  { id: 'hsk2-f6', hanzi: '跳舞', pinyin: 'tiào wǔ', meanings: ['to dance'], hskLevel: 2 },
  { id: 'hsk2-f7', hanzi: '便宜', pinyin: 'pián yi', meanings: ['cheap', 'inexpensive'], hskLevel: 2 },
  { id: 'hsk2-f8', hanzi: '说话', pinyin: 'shuō huà', meanings: ['to speak', 'talk'], hskLevel: 2 },
  { id: 'hsk2-f9', hanzi: '时间', pinyin: 'shí jiān', meanings: ['time', 'period'], hskLevel: 2 },
  { id: 'hsk2-f10', hanzi: '觉得', pinyin: 'jué de', meanings: ['to feel', 'think'], hskLevel: 2 },
  { id: 'hsk2-f11', hanzi: '机场', pinyin: 'jī chǎng', meanings: ['airport'], hskLevel: 2 },
  { id: 'hsk2-f12', hanzi: '公共汽车', pinyin: 'gōng gòng qì chē', meanings: ['bus'], hskLevel: 2 },
  { id: 'hsk2-f13', hanzi: '自行车', pinyin: 'zì xíng chē', meanings: ['bicycle'], hskLevel: 2 },
  { id: 'hsk2-f14', hanzi: '快乐', pinyin: 'kuài lè', meanings: ['happy'], hskLevel: 2 },
  { id: 'hsk2-f15', hanzi: '新', pinyin: 'xīn', meanings: ['new'], hskLevel: 2 },
  { id: 'hsk2-f16', hanzi: '黑', pinyin: 'hēi', meanings: ['black', 'dark'], hskLevel: 2 },
  { id: 'hsk2-f17', hanzi: '红', pinyin: 'hóng', meanings: ['red'], hskLevel: 2 },
  { id: 'hsk2-f18', hanzi: '穿', pinyin: 'chuān', meanings: ['to wear', 'put on'], hskLevel: 2 },
  { id: 'hsk2-f19', hanzi: '药', pinyin: 'yào', meanings: ['medicine'], hskLevel: 2 },
  { id: 'hsk2-f20', hanzi: '生病', pinyin: 'shēng bìng', meanings: ['to get sick'], hskLevel: 2 },
];

const FALLBACK_HSK3: HSKWord[] = [
  { id: 'hsk3-f1', hanzi: '阿姨', pinyin: 'ā yí', meanings: ['auntie', 'housekeeper'], hskLevel: 3 },
  { id: 'hsk3-f2', hanzi: '矮', pinyin: 'ǎi', meanings: ['short (height)'], hskLevel: 3 },
  { id: 'hsk3-f3', hanzi: '安静', pinyin: 'ān jìng', meanings: ['quiet', 'peaceful'], hskLevel: 3 },
  { id: 'hsk3-f4', hanzi: '办法', pinyin: 'bàn fǎ', meanings: ['method', 'way of doing'], hskLevel: 3 },
  { id: 'hsk3-f5', hanzi: '办公室', pinyin: 'bàn gōng shì', meanings: ['office'], hskLevel: 3 },
  { id: 'hsk3-f6', hanzi: '比较', pinyin: 'bǐ jiào', meanings: ['relatively', 'to compare'], hskLevel: 3 },
  { id: 'hsk3-f7', hanzi: '比赛', pinyin: 'bǐ sài', meanings: ['match', 'competition'], hskLevel: 3 },
  { id: 'hsk3-f8', hanzi: '变化', pinyin: 'biàn huà', meanings: ['change', 'transformation'], hskLevel: 3 },
  { id: 'hsk3-f9', hanzi: '表示', pinyin: 'biǎo shì', meanings: ['to express', 'indicate'], hskLevel: 3 },
  { id: 'hsk3-f10', hanzi: '表演', pinyin: 'biǎo yǎn', meanings: ['performance', 'to perform'], hskLevel: 3 },
  { id: 'hsk3-f11', hanzi: '超市', pinyin: 'chāo shì', meanings: ['supermarket'], hskLevel: 3 },
  { id: 'hsk3-f12', hanzi: '简单', pinyin: 'jiǎn dān', meanings: ['simple', 'uncomplicated'], hskLevel: 3 },
  { id: 'hsk3-f13', hanzi: '历史', pinyin: 'lì shǐ', meanings: ['history'], hskLevel: 3 },
  { id: 'hsk3-f14', hanzi: '环境', pinyin: 'huán jìng', meanings: ['environment'], hskLevel: 3 },
  { id: 'hsk3-f15', hanzi: '解决', pinyin: 'jiě jué', meanings: ['to solve', 'resolve'], hskLevel: 3 },
  { id: 'hsk3-f16', hanzi: '聊天', pinyin: 'liáo tiān', meanings: ['to chat'], hskLevel: 3 },
  { id: 'hsk3-f17', hanzi: '选择', pinyin: 'xuǎn zé', meanings: ['to choose', 'select'], hskLevel: 3 },
  { id: 'hsk3-f18', hanzi: '努力', pinyin: 'nǔ lì', meanings: ['hardworking', 'strive'], hskLevel: 3 },
  { id: 'hsk3-f19', hanzi: '清楚', pinyin: 'qīng chu', meanings: ['clear', 'understand clearly'], hskLevel: 3 },
  { id: 'hsk3-f20', hanzi: '影响', pinyin: 'yǐng xiǎng', meanings: ['influence', 'impact'], hskLevel: 3 },
];

const FALLBACK_HSK4: HSKWord[] = [
  { id: 'hsk4-f1', hanzi: '爱情', pinyin: 'ài qíng', meanings: ['love (romantic)'], hskLevel: 4 },
  { id: 'hsk4-f2', hanzi: '安排', pinyin: 'ān pái', meanings: ['to arrange', 'plan'], hskLevel: 4 },
  { id: 'hsk4-f3', hanzi: '保护', pinyin: 'bǎo hù', meanings: ['to protect', 'safeguard'], hskLevel: 4 },
  { id: 'hsk4-f4', hanzi: '报名', pinyin: 'bào míng', meanings: ['to sign up', 'register'], hskLevel: 4 },
  { id: 'hsk4-f5', hanzi: '毕业', pinyin: 'bì yè', meanings: ['to graduate'], hskLevel: 4 },
  { id: 'hsk4-f6', hanzi: '标准', pinyin: 'biāo zhǔn', meanings: ['standard', 'criterion'], hskLevel: 4 },
  { id: 'hsk4-f7', hanzi: '表达', pinyin: 'biǎo dá', meanings: ['to convey', 'express'], hskLevel: 4 },
  { id: 'hsk4-f8', hanzi: '表扬', pinyin: 'biǎo yáng', meanings: ['to praise', 'commend'], hskLevel: 4 },
  { id: 'hsk4-f9', hanzi: '成功', pinyin: 'chéng gōng', meanings: ['success', 'to succeed'], hskLevel: 4 },
  { id: 'hsk4-f10', hanzi: '发展', pinyin: 'fā zhǎn', meanings: ['development', 'to grow'], hskLevel: 4 },
  { id: 'hsk4-f11', hanzi: '支持', pinyin: 'zhī chí', meanings: ['to support', 'stand by'], hskLevel: 4 },
  { id: 'hsk4-f12', hanzi: '肯定', pinyin: 'kěn dìng', meanings: ['definitely', 'certainly'], hskLevel: 4 },
  { id: 'hsk4-f13', hanzi: '丰富', pinyin: 'fēng fù', meanings: ['abundant', 'rich'], hskLevel: 4 },
  { id: 'hsk4-f14', hanzi: '负责', pinyin: 'fù zé', meanings: ['responsible', 'be in charge'], hskLevel: 4 },
  { id: 'hsk4-f15', hanzi: '理解', pinyin: 'lǐ jiě', meanings: ['to comprehend', 'understand'], hskLevel: 4 },
  { id: 'hsk4-f16', hanzi: '组织', pinyin: 'zǔ zhī', meanings: ['organization', 'to organize'], hskLevel: 4 },
  { id: 'hsk4-f17', hanzi: '仔细', pinyin: 'zǐ xì', meanings: ['careful', 'attentive'], hskLevel: 4 },
  { id: 'hsk4-f18', hanzi: '尊重', pinyin: 'zūn zhòng', meanings: ['to respect', 'value'], hskLevel: 4 },
  { id: 'hsk4-f19', hanzi: '总结', pinyin: 'zǒng jié', meanings: ['to summarize'], hskLevel: 4 },
  { id: 'hsk4-f20', hanzi: '交流', pinyin: 'jiāo liú', meanings: ['to communicate', 'exchange'], hskLevel: 4 },
];

const FALLBACKS: Record<number, HSKWord[]> = {
  1: FALLBACK_HSK1,
  2: FALLBACK_HSK2,
  3: FALLBACK_HSK3,
  4: FALLBACK_HSK4,
};

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
      if (level >= 1 && level <= 4) {
        const fb = FALLBACKS[level] || FALLBACK_HSK1;
        mem.set(level, fb);
        return fb;
      }
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
    if (level >= 1 && level <= 4) {
      console.warn(`Using local fallback data for HSK ${level}:`, e);
      const fb = FALLBACKS[level] || FALLBACK_HSK1;
      mem.set(level, fb);
      return fb;
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

