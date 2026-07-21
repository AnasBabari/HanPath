# CLAUDE.md — HànPath (汉路)

This file provide AI coding assistants with comprehensive context on the HànPath codebase: architecture, conventions, data flow, and current state. 

---

## Project Overview

HànPath is a premium, gamified Chinese vocabulary learning application (Duolingo-inspired). It is a **React SPA** that uses **Supabase** for persistence and **OpenRouter** for AI-enhanced learning.

**Key Features:**
- Structured HSK 1-6 Learning Path (Lessons & Units)
- Spaced Repetition System (SM-2 Algorithm)
- AI Learning Buddy (Chat) & Automated Exercise Explanations
- Gamification: Streak, XP, Levels, and 19+ Achievements
- Graded Stories (HSK 1/2)

---

## Tech Stack & Core Dependencies

| Layer | Choice |
|---|---|
| **Framework** | React 19 + TypeScript (Strict) |
| **State Management** | **Zustand** (with `persist` middleware & Zod validation) |
| **Styling** | Vanilla CSS (Duolingo-style 3D tactile theme) |
| **Backend** | Supabase (Auth, `user_progress` table) |
| **AI** | OpenRouter (Multiple free model fallback) |
| **Data Source** | `drkameleon/complete-hsk-vocabulary` via Raw GitHub API |

---

## Project Structure

```
src/
├── components/
│   ├── exercises/
│   │   └── ExerciseRunner.tsx    # Core logic for 7+ exercise types
│   └── ui/                       # AchievementToast, BottomNav, Confetti, etc.
├── pages/
│   ├── LearnPage.tsx             # Interactive lesson path (HSK 1-6)
│   ├── PracticePage.tsx          # SRS reviews, tone drills, grammar
│   ├── StoriesPage.tsx           # Graded readers for HSK 1/2
│   ├── ChatPage.tsx              # AI Learning Buddy (Hanzi + English)
│   └── ProfilePage.tsx           # User stats, cloud sync, leaderboard
├── store/
│   └── useStore.ts               # Global state with Zod runtime validation
├── utils/
│   ├── ai.ts                     # AI integration with error-recovery fallback
│   ├── api.ts                    # HSK data fetching with local cache
│   ├── cloudProgress.ts          # Supabase sync & leaderboard logic
│   ├── curriculum.ts             # Dynamic exercise generation engine
│   ├── srs.ts                    # SM-2 Spaced Repetition logic
│   ├── sounds.ts                 # Real-time Web Audio SFX (no asset lag)
│   └── tts.ts                    # Speech synthesis with Pinyin cleanup
└── App.tsx                       # Main router & cloud hydration
```

---

## Development Guidelines

### State Management (Zustand)
- All shared state is in `src/store/useStore.ts`.
- **Validation**: Use `UserStatsSchema.parse()` (Zod) when updating stats to ensure data integrity.
- **Persistence**: Stats are persisted to `hanpath-progress-v3` in `localStorage`.

### Styling Conventions
- **Variables**: Use tokens from `index.css` (e.g., `--primary`, `--bg-deep`).
- **Tactile UI**: Buttons should have a `border-bottom` and `:active` transform for a physical feel.
- **Responsive**: The layout is centered with a max-width of `520px` for a mobile-first experience.

### AI Integration
- Responses from the AI Buddy MUST include Pinyin in brackets after Hanzi (e.g., 你好(nǐ hǎo)).
- Use the `callOpenRouter` utility in `ai.ts` which handles retries and fallback models.

---

## Current Status & Known Issues

### 🔴 Critical Bugs
- **Supabase Auth Failure**: Console error `AuthApiError: captcha verification process failed`. This prevents anonymous sign-in and cloud syncing.
- **Leaderboard**: Currently showing mock/limited data due to the Auth failure.

### 🟡 UI/UX & Quality Issues
- **Chinese Typography**: Punctuation (`。`, `，`) can wrap to the start of a new line alone in Stories.
- **Contrast**: The lesson progress bar has poor visibility against the dark background.
- **Pedagogical Errors**: Vocab data for "家" (jiā) includes overly complex examples (`家伙`, `家俱`) instead of "Family/Home".

---

## Updated Roadmap

### Phase 1: Polish & Stability (ACTIVE)
- **[DONE]** Zustand migration with persistence.
- **[TODO]** Fix Supabase Captcha/Auth integration.
- **[TODO]** Fix Chinese typography orphans in Stories.
- **[TODO]** Improve global UI/UX contrast and "Premium" desktop aesthetics.

### Phase 2: Content Expansion
- **[TODO]** HSK 2–6 full curriculum toggle.
- **[TODO]** Voice Recognition for pronunciation checks.
- **[TODO]** PWA support for offline learning.

---

## Essential Commands
```powershell
npm run dev      # Start dev server
npm run build    # Production build
npm test         # Run unit tests (if configured)
```
