import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";

export const storySchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      title_zh: { type: "string" },
      hsk_level: { type: "number" },
      tokens: {
        type: "array",
        items: {
          type: "object",
          properties: {
            token: { type: "string" },
            is_word: { type: "boolean" },
            hsk_level: { type: "number" },
            pinyin_hint: { type: "string" },
            meaning: { type: "string" }
          },
          required: ["token", "is_word", "hsk_level", "pinyin_hint", "meaning"]
        }
      }
    },
    required: ["id", "title", "title_zh", "hsk_level", "tokens"]
  }
};

export async function generateStoriesForLevel(level, options = {}) {
  const sleep = options.sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const apiKey = process.env.GEMINI_API_KEY || "mock-key";
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const allStories = [];
  for (let i = 0; i < 4; i++) {
    if (i > 0) {
      await sleep(6000);
    }
    const result = await model.generateContent(`Generate HSK ${level} stories`);
    const parsed = JSON.parse(result.response.text());
    if (Array.isArray(parsed)) {
      allStories.push(...parsed);
    }
  }

  return allStories;
}

if (process.argv[1] && process.argv[1].endsWith('generate_stories.mjs') && !process.env.VITEST) {
  console.log("Stories generator ready.");
}
