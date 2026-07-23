import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');

const HSK_LEVELS = [2];
const BATCH_SIZE = 5;
const TOTAL_STORIES_PER_LEVEL = 20;

// Define the expected output schema using standard Gemini Schema format
const tokenSchema = {
  type: SchemaType.OBJECT,
  properties: {
    token: { type: SchemaType.STRING, description: "The Chinese word/token (Hanzi)" },
    is_word: { type: SchemaType.BOOLEAN, description: "True if it is a learnable word, false for punctuation" },
    hsk_level: { type: SchemaType.NUMBER, description: "The HSK level of the word (1-6). 0 for punctuation." },
    pinyin_hint: { type: SchemaType.STRING, description: "Pinyin for the token (with tone marks)" },
    meaning: { type: SchemaType.STRING, description: "English translation for this specific token" }
  },
  required: ["token", "is_word", "hsk_level", "pinyin_hint", "meaning"]
};

const storySchema = {
  type: SchemaType.ARRAY,
  description: "An array of stories",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: "A unique slug for the story (e.g. 'hsk2-coffee-shop')" },
      title: { type: SchemaType.STRING, description: "Story title in English" },
      title_zh: { type: SchemaType.STRING, description: "Story title in Chinese" },
      hsk_level: { type: SchemaType.NUMBER },
      tokens: {
        type: SchemaType.ARRAY,
        items: tokenSchema
      }
    },
    required: ["id", "title", "title_zh", "hsk_level", "tokens"]
  }
};

async function generateStoriesBatch(level, batchIndex) {
  console.log(`Generating batch ${batchIndex + 1}/${TOTAL_STORIES_PER_LEVEL / BATCH_SIZE} for HSK ${level}...`);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: storySchema,
    }
  });

  const prompt = `
    Write ${BATCH_SIZE} short Chinese reading comprehension stories.
    The stories must strictly use vocabulary from HSK level ${level} and below.
    The topics should be engaging, modern, and practical (e.g., daily life, travel, hobbies, food, weather, shopping).
    Each story should be about 50-80 words long.
    Ensure story IDs are unique, e.g. "hsk${level}-batch${batchIndex+1}-story-1".
    
    Output the stories as an array of JSON objects matching the schema.
    For the "tokens" array, break down the Chinese text into individual words or punctuation marks.
    For each word token, provide the hanzi, pinyin (with tone marks), English meaning, and its HSK level.
    For punctuation tokens, set is_word to false, and leave pinyin_hint and meaning blank.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Failed batch ${batchIndex + 1} for HSK ${level}:`, err);
    return [];
  }
}

async function generateStoriesForLevel(level) {
  const allStories = [];
  const totalBatches = Math.ceil(TOTAL_STORIES_PER_LEVEL / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    let batch = [];
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      batch = await generateStoriesBatch(level, b);
      if (batch.length > 0) break;
      console.log(`Retrying batch ${b + 1} in 15 seconds (attempt ${attempts})...`);
      await new Promise(r => setTimeout(r, 15000));
    }
    allStories.push(...batch);
    if (b < totalBatches - 1) {
      console.log("Waiting 6 seconds before next batch...");
      await new Promise(r => setTimeout(r, 6000));
    }
  }

  // Ensure unique IDs
  const seenIds = new Set();
  return allStories.map((story, index) => {
    let id = story.id || `hsk${level}-story-${index + 1}`;
    if (seenIds.has(id)) {
      id = `hsk${level}-story-${index + 1}-${Math.random().toString(36).slice(2, 6)}`;
    }
    seenIds.add(id);
    return { ...story, id, hsk_level: level };
  });
}

async function main() {
  if (!process.env.VITE_GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error("Error: Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY in your environment variables or .env file.");
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const level of HSK_LEVELS) {
    const stories = await generateStoriesForLevel(level);
    if (stories.length > 0) {
      const filePath = path.join(outDir, `stories_hsk${level}.json`);
      fs.writeFileSync(filePath, JSON.stringify(stories, null, 2));
      console.log(`Saved ${stories.length} HSK ${level} stories to ${filePath}`);
    }
  }
  
  console.log("All HSK 2 stories generated successfully!");
}

export { generateStoriesForLevel, storySchema, tokenSchema };

import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}
