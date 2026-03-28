# HànPath (汉路)

A personal-use, Duolingo-style Chinese learning app built to focus on real reading and listening progression without the friction of a heart system.

## What it includes

- **AI-Powered Learning (Gemini SDK)**:
  - **Chat Buddy**: Practice conversing with an AI that dynamically checks your grammar. (Strictly Hanzi/English only).
  - **Visual Mnemonics**: Generate creative memory tips for any HSK word in the Review tab.
  - **"Explain Why"**: Get instant, encouraging AI feedback when you get an exercise wrong.
- **Graded Stories**: Interactive click-to-translate stories tailored for HSK 1/2, including practical everyday scenarios like ordering food or taxi rides.
- **Practical-First Curriculum**: HSK 1 vocabulary is reordered to prioritize high-frequency, everyday words (greetings, eating, drinking) over strict academic order.
- **Premium Discovery UI**: A beautiful dark gradient interface where upcoming lesson vocabulary is hidden until reached, creating a "surprise" discovery flow.
- **Flashcard Review & SRS**: Specialized drills like "Trouble Words" and SM-2 based spaced repetition.
- **AI Usage Controls**: Built-in 50-call daily limit for AI features to manage your Gemini API quota.
- **Mixed Exercise Types**: 7+ specialized drills across reading, listening, writing, and character composition.
- **Gamification Mechanics**: XP rewards, level-ups, unlocking achievements, and a daily streak tracker.
- **Privacy & Local Persistence**: All progress, streaks, and API keys are stored locally in your browser. No external servers other than official Google APIs.

## Tech stack

- React + TypeScript
- Vite
- Google Generative AI SDK (Gemini)
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

Progress and cached vocabulary are stored safely within your browser under local storage keys. The AI feature requests your Gemini API key strictly from the Profile page and never calls external servers other than Google officially.

The primary progress key is:

- `hanpath-progress-v2`

To reset all learning progress completely, go to the **Profile** tab inside the app and click the "Reset Everything" button, or manually clear your browser's Local Storage via DevTools.
