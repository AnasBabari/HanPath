# HànPath (汉路)

A personal-use, Duolingo-style Chinese learning app built to focus on real reading and listening progression without the friction of a heart system.

## What it includes

- **Real HSK Vocabulary**: Fetches ~500+ HSK Level 1 words from an open-source dataset.
- **Linear Progression**: A structured path where lessons unlock sequentially.
- **Micro-Learning Format**: Short, fast-paced lessons (exactly 4 words per lesson).
- **Mixed Exercise Types** (focusing on reading & listening):
  - Meaning select (character → English)
  - Character select (English → character)
  - Listening select (audio → character)
  - Listening meaning (audio → English)
  - Pinyin typing
  - Character composition
- **Bilingual Prompts**: Pinyin displays seamlessly under characters to reinforce pronunciation context.
- **Gamification Mechanics**: XP rewards, level-ups, unlocking achievements, and a daily streak tracker.
- **No Hearts System**: Practice as much as you want with unlimited attempts.
- **Local Persistence**: Saves all your streak data, unlocked achievements, and lesson progress directly to your local browser storage.

## Tech stack

- React + TypeScript
- Vite
- Web Speech API (for Text-To-Speech)
- Web Audio API (for seamless SFX without external media files)

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in your terminal (typically `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Personal data storage

Progress and cached vocabulary are stored safely within your browser under local storage keys.
The primary progress key is:

- `hanpath-progress-v2`

To reset all learning progress completely, go to the **Profile** tab inside the app and click the "Reset Everything" button, or manually clear your browser's Local Storage via DevTools.
