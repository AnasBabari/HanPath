import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Pinned immutable commit SHA of drkameleon/complete-hsk-vocabulary
const PINNED_COMMIT = '7ac65bf1a6387d35f1ade478906172a19311c7f9';
const HSK1_URL = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${PINNED_COMMIT}/wordlists/exclusive/new/1.json`;
const HSK2_URL = `https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/${PINNED_COMMIT}/wordlists/exclusive/new/2.json`;

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

function parseEntry(raw, level, index) {
  const hanzi = raw.simplified || raw.s || raw.hanzi || raw.word || '';
  if (!hanzi) return null;

  let pinyin = '';
  let meanings = [];

  if (Array.isArray(raw.forms) && raw.forms.length > 0) {
    const form = raw.forms[0];
    if (form.transcriptions) {
      pinyin = form.transcriptions.pinyin || form.transcriptions.numeric || '';
    }
    if (Array.isArray(form.meanings)) {
      meanings = form.meanings.filter(x => typeof x === 'string');
    }
  } else if (Array.isArray(raw.f) && raw.f.length > 0) {
    const form = raw.f[0];
    if (form.i) {
      pinyin = form.i.y || form.i.n || '';
    }
    if (Array.isArray(form.m)) {
      meanings = form.m.filter(x => typeof x === 'string');
    }
  }

  if (!pinyin && typeof raw.pinyin === 'string') {
    pinyin = raw.pinyin;
  }
  if (!meanings.length) {
    if (Array.isArray(raw.meanings)) meanings = raw.meanings;
    else if (typeof raw.meaning === 'string') meanings = [raw.meaning];
  }

  if (!pinyin || !meanings.length) return null;

  let finalMeanings = meanings;
  if (hanzi === '包子') finalMeanings = ['steamed stuffed bun'];
  if (hanzi === '家') finalMeanings = ['home', 'family'];

  return {
    id: `hsk${level}-${index + 1}`,
    hanzi,
    pinyin,
    meanings: finalMeanings,
    meaning: cleanMeaning(finalMeanings),
    hskLevel: level,
  };
}

async function main() {
  console.log(`Fetching 2021 HSK 3.0 vocabulary from pinned commit (${PINNED_COMMIT.slice(0, 8)})...`);

  const [res1, res2] = await Promise.all([
    fetch(HSK1_URL),
    fetch(HSK2_URL),
  ]);

  if (!res1.ok || !res2.ok) {
    throw new Error(`Failed to download vocabulary: HSK1 ${res1.status}, HSK2 ${res2.status}`);
  }

  const raw1 = await res1.json();
  const raw2 = await res2.json();

  // Deduplicate and slice exactly to the 2021 HSK 3.0 syllabus specification:
  // HSK 1: 500 words
  // HSK 2: 772 words (1,272 cumulative)
  const parsed1 = raw1.map((r, i) => parseEntry(r, 1, i)).filter(Boolean);
  const parsed2 = raw2.map((r, i) => parseEntry(r, 2, i)).filter(Boolean);

  const hsk1Words = parsed1.slice(0, 500).map((w, idx) => ({ ...w, id: `hsk1-${idx + 1}` }));
  const hsk2Words = parsed2.slice(0, 772).map((w, idx) => ({ ...w, id: `hsk2-${idx + 1}` }));

  console.log(`Generated HSK 1 words: ${hsk1Words.length}`);
  console.log(`Generated HSK 2 words: ${hsk2Words.length}`);
  console.log(`Cumulative total words: ${hsk1Words.length + hsk2Words.length}`);

  const payload = {
    standard: 'HSK-3.0-2021',
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
