# Mandarin Sprint

A personal-use Chinese learning app in a Duolingo-style format.

## What it includes

- Structured lesson path (beginner to intermediate)
- Mixed exercise types:
  - Multiple choice (character and meaning)
  - Typed answer (pinyin and English)
- Hearts system per lesson
- XP rewards and daily streak tracking
- Lesson score history
- Mistake review at lesson completion
- Local persistence via browser localStorage

## Tech stack

- React + TypeScript
- Vite

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in terminal (typically http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Personal data storage

Progress is stored in your browser under this localStorage key:

- chinese-path-progress-v1

To reset all learning progress, clear that key from DevTools localStorage.

## Suggested daily routine

- Complete one new lesson
- Retry one completed lesson for retention
- Review mistakes shown in lesson summary
