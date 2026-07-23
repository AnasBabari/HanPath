import fs from 'fs';
import path from 'path';

async function fetchHFStories() {
  console.log("Fetching dataset directly from Hugging Face (swaption2009/20k-en-zh-translation-pinyin-hsk)...");
  
  const rawUrl = 'https://huggingface.co/datasets/swaption2009/20k-en-zh-translation-pinyin-hsk/raw/main/hsk_1_4.txt';
  
  try {
    const res = await fetch(rawUrl);
    const text = await res.text();
    
    // Split into blocks by '--'
    const blocks = text.split('--');
    const hsk2Items = [];

    for (let block of blocks) {
      const lines = block.trim().split('\n');
      let item = {};
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('english:')) {
          item.english = line.replace('english:', '').trim();
        } else if (line.startsWith('hsk:')) {
          item.hsk = parseInt(line.replace('hsk:', '').trim());
        } else if (line.startsWith('mandarin:')) {
          item.mandarin = line.replace('mandarin:', '').trim();
        } else if (line.startsWith('pinyin:')) {
          item.pinyin = line.replace('pinyin:', '').trim();
        }
      }

      if (item.hsk === 2 && item.mandarin && item.pinyin && item.english) {
        hsk2Items.push(item);
      }
    }

    console.log(`Successfully scraped ${hsk2Items.length} HSK 2 items from Hugging Face!`);

    if (hsk2Items.length === 0) {
      console.error("No HSK 2 items found.");
      return;
    }

    // Group items into 20 stories (3-4 sentences each)
    const stories = [];
    const targetStoryCount = 20;
    const itemsPerStory = Math.min(4, Math.floor(hsk2Items.length / targetStoryCount));

    for (let i = 0; i < targetStoryCount; i++) {
      const slice = hsk2Items.slice(i * itemsPerStory, (i + 1) * itemsPerStory);
      if (slice.length === 0) break;

      const titleEn = slice[0].english.length > 35 ? slice[0].english.slice(0, 35) + '...' : slice[0].english;
      const titleZh = slice[0].mandarin.slice(0, 10);

      const tokens = [];

      slice.forEach(item => {
        const chars = Array.from(item.mandarin);
        // Clean pinyin punctuation
        const pinyins = item.pinyin.replace(/[。，！？；：.,!?;:]/g, '').split(/\s+/);
        let pinyinIdx = 0;

        chars.forEach(char => {
          const isPunctuation = /[，。！？；：""''（）\s、.,!?;:]/.test(char);
          let py = '';
          if (!isPunctuation) {
            py = pinyins[pinyinIdx] || '';
            pinyinIdx++;
          }

          tokens.push({
            token: char,
            is_word: !isPunctuation,
            hsk_level: isPunctuation ? 0 : 2,
            pinyin_hint: py,
            meaning: isPunctuation ? '' : item.english
          });
        });
      });

      stories.push({
        id: `hsk2-hf-story-${i + 1}`,
        title: titleEn,
        title_zh: titleZh,
        hsk_level: 2,
        tokens
      });
    }

    const outDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outPath = path.join(outDir, 'stories_hsk2.json');
    fs.writeFileSync(outPath, JSON.stringify(stories, null, 2));
    console.log(`Saved ${stories.length} HSK 2 stories to ${outPath}!`);

  } catch (err) {
    console.error("Failed to fetch Hugging Face dataset:", err);
  }
}

fetchHFStories();
