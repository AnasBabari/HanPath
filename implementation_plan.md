# HànPath | Extensive Action Plan

This plan outlines the evolution of HànPath from a high-quality prototype into a production-ready language learning platform. It focuses on stability, scalability, and user engagement.

## User Review Required

> [!IMPORTANT]
> This plan proposes significant architectural changes (State Management, Testing Framework) and new feature sets. Please review the phases and prioritize according to your vision.

---

## 📅 Roadmap Overview

| Phase | Focus | Key Deliverables |
| :--- | :--- | :--- |
| **Phase 1** | **Stability & Scalability** | Zustand State, Vitest Suite, Component Refactoring |
| **Phase 2** | **Mobile & Performance** | PWA Support, Service Workers, Image Optimization |
| **Phase 3** | **Learning Depth** | HSK 2-6 Expansion, Advanced SRS, Voice UI |
| **Phase 4** | **Social & Retention** | Leaderboards, Streaks, Advanced Analytics |

---

## 🏗️ Phase 1: Stability & Infrastructure
**Goal**: Prepare the codebase for rapid scaling and prevent regressions.

### [REFAC] State Management (Zustand)
#### [NEW] [useStore.ts](file:///c:/Users/Babar/Chinese-app-test/src/store/useStore.ts)
Move the global `stats` and `units` state out of `App.tsx` into a dedicated Zustand store.
- **Why**: Prevents "Prop Drilling" and makes state globally accessible without complex hook chains.
- **Impact**: cleaner `App.tsx`, easier debugging with Redux DevTools.

### [NEW] Testing Suite (Vitest + React Testing Library)
#### [NEW] [vitest.config.ts](file:///c:/Users/Babar/Chinese-app-test/vitest.config.ts)
#### [NEW] [srs.test.ts](file:///c:/Users/Babar/Chinese-app-test/src/utils/__tests__/srs.test.ts)
Implement unit tests for critical logic like the Spaced Repetition System (SRS).
- **Why**: Ensures that learning algorithms remain correct as we tweak parameters.

---

## 📱 Phase 2: Mobile Experience & Performance
**Goal**: Make the app feel like a native mobile experience.

### [NEW] Progressive Web App (PWA)
#### [MODIFY] [vite.config.ts](file:///c:/Users/Babar/Chinese-app-test/vite.config.ts)
Integrate `vite-plugin-pwa` to enable offline support and "Add to Home Screen" functionality.
- **Why**: Language learning often happens on the go (subways, planes).
- **Deliverable**: Manifest file, Service Worker for asset caching.

### [MODIFY] Image & Asset Optimization
- Implement lazy loading for icons.
- Use WebP format for all assets (logo, etc.).

---

## 📚 Phase 3: Content & Learning Depth
**Goal**: Provide a pathway for learners from Beginner to Advanced.

### [FEAT] HSK 2-6 Expansion
#### [MODIFY] [api.ts](file:///c:/Users/Babar/Chinese-app-test/src/utils/api.ts)
Extend the curriculum builder to support higher HSK levels.
- **Why**: Retain users as they progress in their learning journey.

### [FEAT] Voice UI (Speech-to-Text)
#### [NEW] [VoiceRecorder.tsx](file:///c:/Users/Babar/Chinese-app-test/src/components/ui/VoiceRecorder.tsx)
Integrate Browser Speech Recognition API for pronunciation practice.
- **Why**: Speaking is the most requested feature in language apps.

---

## 🏆 Phase 4: Social & Retention
**Goal**: Build a community around the learning experience.

### [FEAT] Advanced Gamification
- **Leaderboards**: Daily/Weekly XP challenges between users (using Supabase).
- **Dynamic Achievements**: AI-generated badges based on learning patterns.

---

## 🔍 Gap Analysis: Missing Standard Domain Features
Based on competitor research (HelloChinese, LingoDeer, SuperChinese, Skritter, Pleco), the following key features are currently missing from HànPath:

1. **Speaking Practice & Pronunciation Evaluation**: No exercise types that use Speech Recognition APIs to grade user pronunciation/tones.
2. **Character Writing & Stroke Order**: No on-screen handwriting practice or stroke order validation (crucial for Chinese learning).
3. **Structured Grammar Explanations**: Currently relies heavily on conversational AI. Missing dedicated, readable grammar note sections before or during lessons.
4. **Interactive Tone/Pinyin Practice**: No dedicated Pinyin chart or specific tone minimal-pair drills.
5. **High-Quality Native Audio**: Currently relies on browser TTS, which lacks the natural prosody, pausing, and emotion of native speakers or neural TTS.
6. **Dictionary & Custom Vocab Decks**: Users cannot search for words outside the curriculum or create custom SRS flashcard decks.

---

## 🛠️ Phase 5: Bridging Gaps with Competitors
**Goal**: Elevate HànPath to parity with top language learning apps.

### Phase 5.1: Pronunciation & Speaking Mastery
- **Speech Recognition Exercise Type**: Add `'speaking-repeat'` to `ExerciseType`. Implement a `VoiceRecorder` component using the Web Speech API (`SpeechRecognition`) or a cloud Speech-to-Text API (e.g. Azure) to capture and evaluate user pronunciation.
- **Interactive Pinyin Chart**: Create a `ToolsPage.tsx` with a full Pinyin matrix (initials vs finals) with toggles for all 4 tones.

### Phase 5.2: Character Writing & Stroke Order
- **Hanzi Writer Integration**: Install `hanzi-writer` and add `'writing-stroke'` exercise type. Build a `HanziCanvas.tsx` component that uses quiz mode to validate stroke order on a touch/mouse canvas.
- **Handwriting SRS Mode**: Update `ReviewPage.tsx` to include writing exercises for low easeFactor characters.

### Phase 5.3: Structured Content & Enhanced Audio
- **Grammar Explanations**: Extend `Lesson` type to include optional `grammarNotes` and render a `GrammarBottomSheet.tsx` before beginning a lesson.
- **Neural TTS**: Upgrade from native Web Speech TTS to Azure or ElevenLabs neural TTS for natural intonation, caching audio locally via service workers.

### Phase 5.4: Reference & Personalization
- **Dictionary**: Create `DictionaryPage.tsx` for searching Hanzi/Pinyin/English with stroke order animation, examples, and HSK level.
- **Custom Decks**: Extend store user stats to support `customDecks` and let users add dictionary search results directly to personalized SRS decks.

---

## Open Questions

> [!CAUTION]
> **Priority**: Which phase should we start with? Stability (Phase 1) is recommended for long-term health, but Content (Phase 3) might be more exciting for immediate user feedback.

> [!WARNING]
> **Supabase Usage**: Should we implement a full Auth system (Logins) before starting Phase 4?

## Verification Plan

### Automated Tests
- `npm run test` (to be added in Phase 1)
- `npm run build` to ensure PWA manifest is correctly generated.

### Manual Verification
- Testing "Offline Mode" by disabling network in DevTools.
- Verifying "Add to Home Screen" on a mobile device.
