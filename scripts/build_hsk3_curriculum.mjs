import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Pinned immutable commit SHA of drkameleon/complete-hsk-vocabulary (Release v1.4)
const PINNED_COMMIT = '7ac65bf1a6387d35f1ade478906172a19311c7f9';
const HSK1_URL = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${PINNED_COMMIT}/wordlists/exclusive/new/1.json`;
const HSK2_URL = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${PINNED_COMMIT}/wordlists/exclusive/new/2.json`;
const CURRICULUM_LABEL = 'HSK-3.0-aligned-v1.4';

/**
 * Curated pedagogical overrides for high-frequency beginner vocabulary.
 * Replaces obscure CC-CEDICT polyphones, rare surnames, country abbreviations, and archaic readings
 * with standard HSK 1 and HSK 2 meanings.
 */
const HSK_PEDAGOGICAL_OVERRIDES = {
  '吧': { pinyin: 'ba', meaning: 'modal particle (suggestion, question)', meanings: ['modal particle (suggestion, surmise)', '...right?', '...OK?'] },
  '白': { pinyin: 'bái', meaning: 'white', meanings: ['white', 'clear', 'pure', 'in vain'] },
  '百': { pinyin: 'bǎi', meaning: 'hundred', meanings: ['hundred', 'numerous', 'all kinds of'] },
  '班': { pinyin: 'bān', meaning: 'class; team; shift', meanings: ['class; team; shift', 'work shift'] },
  '包': { pinyin: 'bāo', meaning: 'bag; to wrap; package', meanings: ['bag; package', 'to wrap; to cover'] },
  '包子': { pinyin: 'bāozi', meaning: 'steamed stuffed bun', meanings: ['steamed stuffed bun', 'baozi'] },
  '比': { pinyin: 'bǐ', meaning: 'to compare; than', meanings: ['to compare', 'more ... than', 'ratio'] },
  '别': { pinyin: 'bié', meaning: "don't; other; separate", meanings: ["don't ...!", 'other; another', 'to leave; to part'] },
  '常': { pinyin: 'cháng', meaning: 'often; frequent', meanings: ['often; frequently', 'regular; normal'] },
  '车': { pinyin: 'chē', meaning: 'car; vehicle', meanings: ['car; vehicle', 'machine'] },
  '从': { pinyin: 'cóng', meaning: 'from; since', meanings: ['from; since', 'to follow'] },
  '错': { pinyin: 'cuò', meaning: 'mistake; wrong', meanings: ['mistake; error', 'wrong; incorrect'] },
  '打': { pinyin: 'dǎ', meaning: 'to hit; to play; to call', meanings: ['to hit; to strike', 'to play (ball/game)', 'to make (phone call)', 'to type'] },
  '大学': { pinyin: 'dàxué', meaning: 'university; college', meanings: ['university; college'] },
  '大门': { pinyin: 'dàmén', meaning: 'main entrance; gate', meanings: ['main entrance; front door; gate'] },
  '东': { pinyin: 'dōng', meaning: 'east', meanings: ['east; eastern'] },
  '都': { pinyin: 'dōu', meaning: 'all; both', meanings: ['all; both; entirely'] },
  '第': { pinyin: 'dì', meaning: 'ordinal number prefix', meanings: ['prefix for ordinal numbers (first, second, etc.)'] },
  '点': { pinyin: 'diǎn', meaning: "point; o'clock; a little", meanings: ['point; dot', "o'clock", 'a little; a bit', 'to order (food)'] },
  '动': { pinyin: 'dòng', meaning: 'to move; to act', meanings: ['to move; to set in motion', 'to act; to use'] },
  '干': { pinyin: 'gàn', meaning: 'to do; to work', meanings: ['to do; to work', 'capable; effective'] },
  '高': { pinyin: 'gāo', meaning: 'tall; high', meanings: ['tall; high', 'above average'] },
  '好玩儿': { pinyin: 'hǎowánr', meaning: 'fun; interesting', meanings: ['fun; amusing; interesting'] },
  '关': { pinyin: 'guān', meaning: 'to close; to shut; to turn off', meanings: ['to close; to shut', 'to turn off', 'to concern'] },
  '国': { pinyin: 'guó', meaning: 'country; nation', meanings: ['country; nation; state'] },
  '过': { pinyin: 'guò', meaning: 'to cross; to pass; past particle', meanings: ['to cross; to pass', 'particle indicating past experience'] },
  '还': { pinyin: 'hái', meaning: 'still; also; yet', meanings: ['still; yet', 'also; in addition'] },
  '和': { pinyin: 'hé', meaning: 'and; with; peaceful', meanings: ['and; with', 'peaceful; harmonious'] },
  '后': { pinyin: 'hòu', meaning: 'back; behind; after', meanings: ['back; behind', 'after; later'] },
  '花': { pinyin: 'huā', meaning: 'flower; to spend', meanings: ['flower; blossom', 'to spend (money/time)'] },
  '家': { pinyin: 'jiā', meaning: 'home; family', meanings: ['home; family', 'household'] },
  '家人': { pinyin: 'jiārén', meaning: 'family member', meanings: ['family member; family'] },
  '考': { pinyin: 'kǎo', meaning: 'to test; to take an exam', meanings: ['to test; to examine', 'to take an exam'] },
  '教': { pinyin: 'jiāo', meaning: 'to teach', meanings: ['to teach; to instruct'] },
  '冷': { pinyin: 'lěng', meaning: 'cold', meanings: ['cold; chilly'] },
  '里': { pinyin: 'lǐ', meaning: 'inside; within', meanings: ['inside; internal', 'within; in'] },
  '两': { pinyin: 'liǎng', meaning: 'two; both', meanings: ['two; both', 'a few; some'] },
  '楼': { pinyin: 'lóu', meaning: 'building; floor', meanings: ['building with stories', 'floor; level'] },
  '路': { pinyin: 'lù', meaning: 'road; path; route', meanings: ['road; path; street', 'route; journey'] },
  '毛': { pinyin: 'máo', meaning: 'hair; fur; 10 cents', meanings: ['hair; fur; feather', 'dime; 10 cents'] },
  '门': { pinyin: 'mén', meaning: 'door; gate; entrance', meanings: ['door; gate; entrance', 'classifier for subjects/classes'] },
  '面条儿': { pinyin: 'miàntiáor', meaning: 'noodles', meanings: ['noodles'] },
  '拿': { pinyin: 'ná', meaning: 'to take; to hold', meanings: ['to take; to hold; to seize'] },
  '那': { pinyin: 'nà', meaning: 'that; those', meanings: ['that; those', 'then; in that case'] },
  '男孩儿': { pinyin: 'nánháir', meaning: 'boy', meanings: ['boy'] },
  '南': { pinyin: 'nán', meaning: 'south', meanings: ['south; southern'] },
  '能': { pinyin: 'néng', meaning: 'can; to be able to', meanings: ['can; to be able to', 'ability; capability'] },
  '年': { pinyin: 'nián', meaning: 'year', meanings: ['year', 'annual'] },
  '老': { pinyin: 'lǎo', meaning: 'old; experienced', meanings: ['old; aged', 'experienced', 'always'] },
  '钱': { pinyin: 'qián', meaning: 'money; coin', meanings: ['money; coins; currency'] },
  '去': { pinyin: 'qù', meaning: 'to go; to leave', meanings: ['to go; to go to', 'to leave; to remove'] },
  '日': { pinyin: 'rì', meaning: 'sun; day; date', meanings: ['sun', 'day; date'] },
  '三': { pinyin: 'sān', meaning: 'three', meanings: ['three'] },
  '山': { pinyin: 'shān', meaning: 'mountain; hill', meanings: ['mountain; hill'] },
  '书': { pinyin: 'shū', meaning: 'book; to write', meanings: ['book', 'letter; document', 'to write'] },
  '水': { pinyin: 'shuǐ', meaning: 'water; liquid', meanings: ['water', 'liquid; river'] },
  '岁': { pinyin: 'suì', meaning: 'years old; age', meanings: ['years of age', 'year'] },
  '听': { pinyin: 'tīng', meaning: 'to listen; to hear', meanings: ['to listen; to hear', 'to obey'] },
  '开': { pinyin: 'kāi', meaning: 'to open; to turn on; to start', meanings: ['to open', 'to turn on', 'to start; to operate'] },
  '西': { pinyin: 'xī', meaning: 'west', meanings: ['west; western'] },
  '小孩儿': { pinyin: 'xiǎoháir', meaning: 'child', meanings: ['child; kid'] },
  '笑': { pinyin: 'xiào', meaning: 'to laugh; to smile', meanings: ['to laugh; to smile'] },
  '行': { pinyin: 'xíng', meaning: 'okay; to go; capable', meanings: ['okay; all right', 'to go; to travel', 'capable'] },
  '新': { pinyin: 'xīn', meaning: 'new; fresh', meanings: ['new; fresh', 'novel'] },
  '也': { pinyin: 'yě', meaning: 'also; too', meanings: ['also; too', 'as well'] },
  '一点儿': { pinyin: 'yīdiǎnr', meaning: 'a little; a bit', meanings: ['a little; a bit'] },
  '一块儿': { pinyin: 'yīkuàir', meaning: 'together', meanings: ['together', 'in the same place'] },
  '一下儿': { pinyin: 'yīxiàr', meaning: 'once; briefly', meanings: ['once; one time', 'briefly; for a moment'] },
  '元': { pinyin: 'yuán', meaning: 'yuan (currency unit)', meanings: ['Chinese currency unit (yuan)', 'primary; first'] },
  '右': { pinyin: 'yòu', meaning: 'right; right-hand side', meanings: ['right; right-hand side'] },
  '这里': { pinyin: 'zhèlǐ', meaning: 'here', meanings: ['here; this place'] },
  '在家': { pinyin: 'zàijiā', meaning: 'to be at home', meanings: ['to be at home'] },
  '中': { pinyin: 'zhōng', meaning: 'in; middle; center', meanings: ['in; among; within', 'middle; center'] },
  '最': { pinyin: 'zuì', meaning: 'most; -est', meanings: ['most; -est; superlative'] },
  '左': { pinyin: 'zuǒ', meaning: 'left', meanings: ['left; left side'] },
  '坐': { pinyin: 'zuò', meaning: 'to sit; to ride', meanings: ['to sit', 'to ride/travel by (bus, train, plane)'] },
  // HSK 2 Overrides
  '背': { pinyin: 'bēi', meaning: 'to carry on back; to bear', meanings: ['to carry on the back', 'to bear (burden)'] },
  '遍': { pinyin: 'biàn', meaning: 'everywhere; all over; time/round', meanings: ['everywhere; all over', 'classifier for actions (times/rounds)'] },
  '草': { pinyin: 'cǎo', meaning: 'grass; straw', meanings: ['grass; straw; herb', 'rough; hasty'] },
  '查': { pinyin: 'chá', meaning: 'to check; to investigate', meanings: ['to check; to look up', 'to investigate; to research'] },
  '成': { pinyin: 'chéng', meaning: 'to become; to succeed', meanings: ['to become; to turn into', 'to succeed; capable'] },
  '船': { pinyin: 'chuán', meaning: 'boat; ship', meanings: ['boat; ship; vessel'] },
  '词': { pinyin: 'cí', meaning: 'word; term; lyrics', meanings: ['word; term', 'expression; lyrics'] },
  '蛋': { pinyin: 'dàn', meaning: 'egg', meanings: ['egg', 'oval-shaped object'] },
  '东北': { pinyin: 'dōngběi', meaning: 'northeast', meanings: ['northeast'] },
  '东方': { pinyin: 'dōngfāng', meaning: 'the east; eastern', meanings: ['the east; orient; eastern'] },
  '段': { pinyin: 'duàn', meaning: 'section; paragraph; segment', meanings: ['section; segment; paragraph', 'stage (of process)'] },
  '封': { pinyin: 'fēng', meaning: 'classifier for letters; to seal', meanings: ['classifier for letters/mail', 'to seal; to envelope'] },
  '方便': { pinyin: 'fāngbiàn', meaning: 'convenient; suitable', meanings: ['convenient; suitable', 'to make things easier'] },
  '份': { pinyin: 'fèn', meaning: 'portion; copy; classifier', meanings: ['portion; share', 'copy', 'classifier for documents, meals, and jobs'] },
  '海': { pinyin: 'hǎi', meaning: 'sea; ocean', meanings: ['sea; ocean'] },
  '黑': { pinyin: 'hēi', meaning: 'black; dark', meanings: ['black; dark'] },
  '画': { pinyin: 'huà', meaning: 'to draw; picture', meanings: ['to draw; to paint', 'picture; painting'] },
  '红': { pinyin: 'hóng', meaning: 'red; popular', meanings: ['red', 'popular; successful'] },
  '黄': { pinyin: 'huáng', meaning: 'yellow', meanings: ['yellow'] },
  '加': { pinyin: 'jiā', meaning: 'to add; plus', meanings: ['to add', 'plus', 'to increase'] },
  '交': { pinyin: 'jiāo', meaning: 'to hand over; to pay; to make friends', meanings: ['to hand over; to deliver', 'to pay', 'to make friends'] },
  '角': { pinyin: 'jiǎo', meaning: 'horn; corner; 10 cents', meanings: ['horn; angle; corner', 'dime; 10 cents'] },
  '举': { pinyin: 'jǔ', meaning: 'to lift; to raise; to act', meanings: ['to lift; to raise', 'to cite (examples)', 'act; deed'] },
  '句': { pinyin: 'jù', meaning: 'sentence; clause', meanings: ['sentence; clause', 'classifier for sentences/lines'] },
  '酒店': { pinyin: 'jiǔdiàn', meaning: 'hotel', meanings: ['hotel'] },
  '克': { pinyin: 'kè', meaning: 'gram; to overcome', meanings: ['gram (unit of weight)', 'to overcome; to conquer'] },
  '卡': { pinyin: 'kǎ', meaning: 'card; to block', meanings: ['card', 'to block; to stop'] },
  '靠': { pinyin: 'kào', meaning: 'to lean on; to depend on', meanings: ['to lean against', 'to depend on; to rely on', 'to come near'] },
  '蓝': { pinyin: 'lán', meaning: 'blue', meanings: ['blue'] },
  '离': { pinyin: 'lí', meaning: 'away from; to leave', meanings: ['away from (distance/time)', 'to leave; to depart'] },
  '凉': { pinyin: 'liáng', meaning: 'cool; cold', meanings: ['cool; refreshing', 'cold'] },
  '留': { pinyin: 'liú', meaning: 'to stay; to remain; to leave (message)', meanings: ['to stay; to remain', 'to leave (a message/record)'] },
  '满': { pinyin: 'mǎn', meaning: 'full; filled', meanings: ['full; filled', 'to fill', 'satisfied'] },
  '米': { pinyin: 'mǐ', meaning: 'rice; meter', meanings: ['rice', 'meter (unit of length)'] },
  '鸟': { pinyin: 'niǎo', meaning: 'bird', meanings: ['bird'] },
  '女孩儿': { pinyin: 'nǚháir', meaning: 'girl', meanings: ['girl'] },
  '怕': { pinyin: 'pà', meaning: 'to fear; afraid of', meanings: ['to fear; to be afraid of', 'perhaps'] },
  '篇': { pinyin: 'piān', meaning: 'article; piece of writing', meanings: ['article; piece of writing', 'classifier for articles or chapters'] },
  '碰': { pinyin: 'pèng', meaning: 'to touch; to bump; to meet', meanings: ['to touch; to bump against', 'to meet by chance'] },
  '平': { pinyin: 'píng', meaning: 'flat; level; equal', meanings: ['flat; level', 'equal; calm'] },
  '墙': { pinyin: 'qiáng', meaning: 'wall', meanings: ['wall'] },
  '骑': { pinyin: 'qí', meaning: 'to ride', meanings: ['to ride (a bicycle, horse, etc.)'] },
  '全': { pinyin: 'quán', meaning: 'all; whole; complete', meanings: ['all; whole; entire', 'complete'] },
  '道': { pinyin: 'dào', meaning: 'road; way; method', meanings: ['road; path; way', 'method; principle', 'classifier for questions or courses'] },
  '超市': { pinyin: 'chāoshì', meaning: 'supermarket', meanings: ['supermarket'] },
  '干活儿': { pinyin: 'gànhuór', meaning: 'to work', meanings: ['to work; to do a job'] },
  '快点儿': { pinyin: 'kuàidiǎnr', meaning: 'hurry up; more quickly', meanings: ['hurry up', 'more quickly'] },
  '难听': { pinyin: 'nántīng', meaning: 'unpleasant to hear', meanings: ['unpleasant to hear', 'offensive; harsh-sounding'] },
  '省': { pinyin: 'shěng', meaning: 'to save; to economize; province', meanings: ['to save; to economize', 'to omit', 'province'] },
  '太阳': { pinyin: 'tàiyáng', meaning: 'sun', meanings: ['sun'] },
  '题': { pinyin: 'tí', meaning: 'topic; question; problem', meanings: ['topic; subject', 'question; exam problem'] },
  '腿': { pinyin: 'tuǐ', meaning: 'leg', meanings: ['leg'] },
  '碗': { pinyin: 'wǎn', meaning: 'bowl', meanings: ['bowl'] },
  '闻': { pinyin: 'wén', meaning: 'to smell; to hear (news)', meanings: ['to smell', 'to hear (news)', 'reputation'] },
  '西北': { pinyin: 'xīběi', meaning: 'northwest', meanings: ['northwest'] },
  '相机': { pinyin: 'xiàngjī', meaning: 'camera', meanings: ['camera'] },
  '向': { pinyin: 'xiàng', meaning: 'towards; to face', meanings: ['towards; to', 'to face; direction'] },
  '姓': { pinyin: 'xìng', meaning: 'family name; to be surnamed', meanings: ['family name; surname', 'to be surnamed'] },
  '姓名': { pinyin: 'xìngmíng', meaning: 'full name; name', meanings: ['full name; name', 'surname and given name'] },
  '雪': { pinyin: 'xuě', meaning: 'snow', meanings: ['snow'] },
  '行人': { pinyin: 'xíngrén', meaning: 'pedestrian; passer-by', meanings: ['pedestrian', 'passer-by'] },
  '药': { pinyin: 'yào', meaning: 'medicine; drug', meanings: ['medicine; drug', 'remedy'] },
  '药水': { pinyin: 'yàoshuǐ', meaning: 'liquid medicine', meanings: ['liquid medicine', 'potion'] },
  '得': { pinyin: 'de', meaning: 'structural particle after a verb', meanings: ['particle linking a verb with a complement'] },
  '着': { pinyin: 'zhe', meaning: 'aspect particle indicating a continuing state', meanings: ['particle indicating an ongoing action or state'] },
  '为': { pinyin: 'wèi', meaning: 'for; on behalf of', meanings: ['for; for the sake of', 'on behalf of'] },
  '夜': { pinyin: 'yè', meaning: 'night; evening', meanings: ['night; evening'] },
  '阴': { pinyin: 'yīn', meaning: 'overcast; cloudy; shade', meanings: ['overcast; cloudy', 'shade', 'negative'] },
  '友好': { pinyin: 'yǒuhǎo', meaning: 'friendly; amicable', meanings: ['friendly; amicable', 'friendship'] },
  '院子': { pinyin: 'yuànzi', meaning: 'courtyard; yard', meanings: ['courtyard; yard; garden'] },
  '鱼': { pinyin: 'yú', meaning: 'fish', meanings: ['fish'] },
  '越': { pinyin: 'yuè', meaning: 'to exceed; the more...', meanings: ['to exceed; to cross', 'the more... the more...'] },
  '咱': { pinyin: 'zán', meaning: 'we; us (inclusive)', meanings: ['we; us (including the listener)', 'I; me'] },
  '占': { pinyin: 'zhàn', meaning: 'to occupy; to take up', meanings: ['to occupy; to take up', 'to account for'] },
  '纸': { pinyin: 'zhǐ', meaning: 'paper', meanings: ['paper'] },
  '周': { pinyin: 'zhōu', meaning: 'week; cycle; circuit', meanings: ['week', 'cycle; circuit', 'all around'] },
  '组': { pinyin: 'zǔ', meaning: 'group; team; to organize', meanings: ['group; team', 'to organize; to compose'] },
  '座': { pinyin: 'zuò', meaning: 'seat; classifier for buildings', meanings: ['seat', 'classifier for buildings and mountains'] },
  '重点': { pinyin: 'zhòngdiǎn', meaning: 'key point; focus; main point', meanings: ['important point; main point; focus', 'key (project etc)', 'to focus on; to emphasize'] },
};

function cleanMeaning(raw) {
  if (!raw) return '';
  const list = Array.isArray(raw) ? raw : [raw];
  const candidates = [];
  for (const item of list) {
    for (const sub of String(item).split(';')) {
      const trimmed = sub.trim();
      if (!trimmed || /^\(.*\)$/.test(trimmed)) continue;
      const cleaned = trimmed.replace(/^\([^)]*\)\s*/g, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
      if (cleaned) candidates.push(cleaned);
    }
  }
  if (!candidates.length) return String(list[0] || '');
  const short = candidates.find(c => c.length <= 25);
  return short || candidates[0];
}

function scoreForm(form) {
  let score = 100;
  const pinyin = form.transcriptions?.pinyin || form.i?.y || '';
  const meanings = form.meanings || form.m || [];
  const firstMeaning = (meanings[0] || '').toLowerCase();
  const allMeanings = meanings.join(' ').toLowerCase();

  // Heavy penalties for non-primary beginner meanings
  if (allMeanings.includes('surname')) score -= 80;
  if (allMeanings.includes('abbr. for')) score -= 80;
  if (allMeanings.includes('variant of') || allMeanings.includes('old variant')) score -= 70;
  if (allMeanings.includes('(onom.)') || allMeanings.includes('(archaic)')) score -= 70;
  if (allMeanings.includes('(loanword)')) score -= 40;
  if (allMeanings.includes('district of') || allMeanings.includes('city in') || allMeanings.includes('province of')) score -= 60;
  if (allMeanings.includes('euphemistic') || allMeanings.includes('vulgar')) score -= 90;

  // Proper nouns penalty (capitalized pinyin)
  if (/^[A-Z]/.test(pinyin)) score -= 50;

  // Neutral / short word bonus
  if (meanings.length > 1) score += 10;

  return score;
}

function parseEntry(raw, level, index) {
  const hanzi = raw.simplified || raw.s || raw.hanzi || raw.word || '';
  if (!hanzi) return null;

  // 1. Check human-curated pedagogical overrides first
  if (HSK_PEDAGOGICAL_OVERRIDES[hanzi]) {
    const override = HSK_PEDAGOGICAL_OVERRIDES[hanzi];
    return {
      id: `hsk${level}-${index + 1}`,
      hanzi,
      pinyin: override.pinyin,
      meanings: override.meanings,
      meaning: override.meaning,
      hskLevel: level,
    };
  }

  // 2. Score forms to find the best beginner reading and meaning
  let bestPinyin = '';
  let bestMeanings = [];
  const forms = Array.isArray(raw.forms) ? raw.forms : Array.isArray(raw.f) ? raw.f : [];

  if (forms.length > 0) {
    let highestScore = -Infinity;
    let selectedForm = forms[0];

    for (const f of forms) {
      const s = scoreForm(f);
      if (s > highestScore) {
        highestScore = s;
        selectedForm = f;
      }
    }

    if (selectedForm.transcriptions) {
      bestPinyin = selectedForm.transcriptions.pinyin || selectedForm.transcriptions.numeric || '';
    } else if (selectedForm.i) {
      bestPinyin = selectedForm.i.y || selectedForm.i.n || '';
    }

    const rawM = selectedForm.meanings || selectedForm.m || [];
    if (Array.isArray(rawM)) {
      bestMeanings = rawM.filter(x => typeof x === 'string');
    }
  }

  if (!bestPinyin && typeof raw.pinyin === 'string') {
    bestPinyin = raw.pinyin;
  }
  if (!bestMeanings.length) {
    if (Array.isArray(raw.meanings)) bestMeanings = raw.meanings;
    else if (typeof raw.meaning === 'string') bestMeanings = [raw.meaning];
  }

  if (!bestPinyin || !bestMeanings.length) return null;

  return {
    id: `hsk${level}-${index + 1}`,
    hanzi,
    pinyin: bestPinyin,
    meanings: bestMeanings,
    meaning: cleanMeaning(bestMeanings),
    hskLevel: level,
  };
}

async function main() {
  console.log(`Fetching HSK 3.0 vocabulary from pinned commit (${PINNED_COMMIT.slice(0, 8)})...`);

  const [res1, res2] = await Promise.all([
    fetch(HSK1_URL),
    fetch(HSK2_URL),
  ]);

  if (!res1.ok || !res2.ok) {
    throw new Error(`Failed to download vocabulary: HSK1 ${res1.status}, HSK2 ${res2.status}`);
  }

  const raw1 = await res1.json();
  const raw2 = await res2.json();

  const parsed1 = raw1.map((r, i) => parseEntry(r, 1, i)).filter(Boolean);
  const parsed2 = raw2.map((r, i) => parseEntry(r, 2, i)).filter(Boolean);

  if (parsed1.length !== 506 || parsed2.length !== 750) {
    throw new Error(
      `Pinned upstream count changed unexpectedly (HSK1=${parsed1.length}, HSK2=${parsed2.length}); review before publishing.`
    );
  }

  const hsk1Words = parsed1.map((w, idx) => ({ ...w, id: `hsk1-${idx + 1}` }));
  const hsk2Words = parsed2.map((w, idx) => ({ ...w, id: `hsk2-${idx + 1}` }));

  console.log(`Generated HSK 1 words: ${hsk1Words.length}`);
  console.log(`Generated HSK 2 words: ${hsk2Words.length}`);
  console.log(`Cumulative total words: ${hsk1Words.length + hsk2Words.length}`);

  const payload = {
    standard: CURRICULUM_LABEL,
    datasetStatus: 'community-curated',
    upstreamRelease: 'v1.4',
    provenanceNotice: 'Community-curated HSK 3.0-aligned vocabulary derived from the pinned upstream release with HanPath pedagogical overrides; not an official CTI/CLEC publication.',
    syllabusReference: 'https://www.chinesetest.cn/HSK',
    normalizedDatasetSource: `https://github.com/drkameleon/complete-hsk-vocabulary/tree/${PINNED_COMMIT}`,
    pinnedCommit: PINNED_COMMIT,
    license: 'MIT',
    retrievalDate: '2026-08-22',
    schemaVersion: 1,
    counts: {
      hsk1: hsk1Words.length,
      hsk2: hsk2Words.length,
      cumulative: hsk1Words.length + hsk2Words.length,
    },
    hsk1: hsk1Words,
    hsk2: hsk2Words,
  };

  // Deterministic JSON formatting and SHA256 checksum calculation
  const jsonForHash = JSON.stringify(payload, null, 2);
  const checksum = crypto.createHash('sha256').update(jsonForHash).digest('hex');
  payload.sha256 = checksum;

  const outPath = path.resolve(process.cwd(), 'src', 'data', 'curriculum_hsk3_v1.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Successfully generated curriculum at ${outPath}`);
  console.log(`SHA-256 Checksum: ${checksum}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
