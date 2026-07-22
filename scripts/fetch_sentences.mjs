import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data');

if (!fs.existsSync(PUBLIC_DATA_DIR)) {
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
}

// Helper to segment Chinese text into words using Intl.Segmenter
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

function segmentText(text) {
  const segments = Array.from(segmenter.segment(text));
  return segments
    .map(s => s.segment.trim())
    .filter(s => s.length > 0 && !/^[\s\p{P}]+$/u.test(s)); // exclude punctuation/whitespace
}

async function fetchHuggingFaceRows() {
  console.log('Fetching sentences dataset from Hugging Face...');
  const sentences = [];
  const limit = 100;
  let offset = 0;
  const maxRowsToFetch = 1000; 

  let currentItem = {};

  while (offset < maxRowsToFetch) {
    try {
      const url = `https://datasets-server.huggingface.co/rows?dataset=swaption2009%2F20k-en-zh-translation-pinyin-hsk&config=default&split=train&offset=${offset}&length=${limit}`;
      console.log(`Fetching offset ${offset}...`);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) {
        console.error(`HTTP error ${res.status} ${res.statusText} at offset ${offset}`);
        break;
      }
      const data = await res.json();
      if (!data.rows || data.rows.length === 0) break;

      for (const item of data.rows) {
        const line = item.row.text ? item.row.text.trim() : '';
        if (line.startsWith('english:')) {
          currentItem.english = line.replace(/^english:\s*/i, '').trim();
        } else if (line.startsWith('hsk:')) {
          const hskNum = parseInt(line.replace(/^hsk:\s*/i, '').trim(), 10);
          currentItem.hsk = isNaN(hskNum) ? 1 : hskNum;
        } else if (line.startsWith('chinese:')) {
          currentItem.chinese = line.replace(/^chinese:\s*/i, '').trim();
        } else if (line.startsWith('pinyin:')) {
          currentItem.pinyin = line.replace(/^pinyin:\s*/i, '').trim();
        } else if (line === '--' || line === '') {
          if (currentItem.chinese && currentItem.english) {
            const tiles = segmentText(currentItem.chinese);
            if (tiles.length > 0) {
              sentences.push({
                id: sentences.length + 1,
                hsk: currentItem.hsk || 1,
                zh: currentItem.chinese,
                en: currentItem.english,
                py: currentItem.pinyin || '',
                tiles: tiles,
                required_words: Array.from(new Set(tiles)),
              });
            }
          }
          currentItem = {};
        }
      }

      offset += limit;
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error('Error fetching batch:', err);
      break;
    }
  }

  return sentences;
}

async function main() {
  let sentences = await fetchHuggingFaceRows();

  // Fallback static sentences if offline/network error
  if (sentences.length === 0) {
    console.log('Using static fallback sentences array...');
    sentences = [
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
  }

  console.log(`Total parsed sentences: ${sentences.length}`);

  // Group by HSK level
  const byHsk = {};
  for (const s of sentences) {
    const lvl = s.hsk || 1;
    if (!byHsk[lvl]) byHsk[lvl] = [];
    byHsk[lvl].push(s);
  }

  // Write out files per HSK level
  for (const [lvl, list] of Object.entries(byHsk)) {
    const filePath = path.join(PUBLIC_DATA_DIR, `hsk${lvl}_sentences.json`);
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
    console.log(`Saved ${list.length} sentences to ${filePath}`);
  }
}

main().catch(console.error);
