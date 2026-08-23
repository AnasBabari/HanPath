<div align="center">
  <img src="public/favicon.svg" alt="HànPath Logo" width="80" height="80" />
  <h1>汉路 HànPath</h1>
  
  <p><strong>A modern, local-first Chinese learning platform with community-curated HSK 3.0-aligned vocabulary, spaced repetition (SRS), graded stories, and pedagogical AI tutoring.</strong></p>

  <p>
    <a href="https://han-path.vercel.app">🚀 View Live App</a> •
    <a href="#-getting-started">💻 Getting Started</a> •
    <a href="#-architecture--infrastructure">🏗️ Architecture</a> •
    <a href="#-curriculum--stories-provenance">📚 Curriculum & Stories</a>
  </p>
</div>

<br />

---

## 🌟 Overview

**HànPath** is built for learners mastering Mandarin Chinese with pedagogical rigor, offline resilience, and immediate zero-friction local-first persistence.

- 📚 **HSK 3.0-Aligned Vocabulary:** All 506 level-1 and 750 level-2 entries (1,256 cumulative) from pinned upstream v1.4 lists, with HanPath pedagogical definitions, pinyin, audio pronunciation, and interactive stroke-order canvas practice.
- 📖 **16 Graded Stories:** 8 coherent narrative stories per level with tokenized glosses, character popups, and pinyin assistance.
- 🤖 **Pedagogical AI Language Buddy:** Secured serverless OpenRouter proxy with fallback routing, strict pedagogical system prompts, and context isolation.
- 💾 **Robust Local-First Persistence:** Authoritative browser storage using a versioned schema (`ProgressSnapshotV4`), real-time storage write health detection, and JSON export/restore with preview confirmation.
- ⚡ **Ultra-Fast Performance:** Initial page-load bundle budget strictly enforced at **<= 130 KB gzip** with dynamic code-splitting and PWA offline caching.
- ♿ **Accessibility (a11y):** Keyboard navigation, accessible dialog focus trapping, live regions, and automated axe-core accessibility testing.

---

## 🛠️ Architecture & Infrastructure

HànPath is designed with a **local-first frontend architecture** coupled with a lightweight **serverless AI proxy backend**:

```text
Browser Client (React 19 + Vite 8 + Zustand)
  ├── Learning Engine (Lessons, Exercises, Stroke Order, SRS Scheduler)
  ├── Local-First Storage (Validated ProgressSnapshotV4 & Health Detection)
  ├── Data Portability (JSON Export & Interactive Restore Confirmation)
  ├── PWA Offline Caching (Service Worker & Static Curriculum Cache)
  │
  └── Backend Serverless API (Vercel Edge/Node Functions)
        ├── /api/chat   ──> Signed Guest HMAC Identity + Distributed Quotas + OpenRouter Fallback
        └── /api/health ──> Service Health & Readiness Probe
```

### Key Technical Systems

1. **Local-First State & Storage Health**
   - Authoritative learning progress is stored directly in browser storage using `ProgressSnapshotV4` (Zod validated).
   - `saveSnapshotToStorage` monitors storage write health and displays real-time status in the user Profile if browser storage quotas or private-browsing restrictions trigger an error.
   - Built-in data portability allows learners to export full JSON snapshots and restore them across devices with schema validation and candidate confirmation previews.

2. **Secured Serverless AI Tutor Proxy**
   - The browser client never touches OpenRouter API keys.
   - Server-authored pedagogical system prompts enforce helpful language instruction tailored to HSK 1 and 2 levels.
   - Total 15-second deadline with automatic multi-model fallback (`qwen3-4b`, `qwen3-coder`, `llama-3.2-3b`, `trinity-large`).
   - Strict origin validation, JSON content-type enforcement, 32 KB body bounds, and prompt injection mitigations.

3. **Stateless Identity & Distributed Quota Enforcement**
   - Anonymous learners receive tamper-proof HMAC-SHA256 signed cookies (`hanpath_guest_id`).
   - Quotas (5 requests / day) are tracked atomically via PostgreSQL RPC, backed by a secondary subnet/user-agent HMAC bucket to prevent trivial cookie-clearing abuse.
   - Production quota storage fails closed with HTTP 503 rather than silently bypassing rate limits.

---

## 📚 Curriculum & Stories Provenance

- **Status:** Community-curated, HSK 3.0-aligned learning content—not an official CTI/CLEC publication or certification.
- **Normalized Dataset Source:** `drkameleon/complete-hsk-vocabulary` release v1.4, pinned to commit `7ac65bf1a6387d35f1ade478906172a19311c7f9`, with HanPath pedagogical overrides.
- **Exact Pinned Counts:** **506 level-1** entries and **750 level-2** entries (1,256 cumulative); verified deterministically by build-time checksums.
- **Graded Stories:** 8 stories per level (16 total), with curriculum vocabulary verified against the generated artifacts and bounded support word glosses.
- **License:** MIT License.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `20.x` or later
- npm `10.x` or later

### 1. Installation & Local Development
```bash
# Clone the repository
git clone https://github.com/AnasBabari/HanPath.git
cd HanPath

# Install dependencies
npm ci

# Start the Vite development server
npm run dev
```

### 2. Environment Configuration
Create a `.env.local` file for serverless AI features:
```env
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GUEST_COOKIE_SECRET=your-secure-random-32-char-secret
APP_ORIGIN=https://your-production-app.vercel.app
```

---

## 🧪 Testing & Quality Gates

The automated CI pipeline enforces comprehensive quality verification:

```bash
# Run all quality checks (TypeScript, lint, unit tests, bundle audit)
npm run check

# Run unit and integration tests (Vitest)
npm run test:unit

# Run full test coverage report (v8)
npm run test:coverage

# Run axe-core accessibility tests
npm run test:a11y

# Run serverless API tests
npm run test:api

# Run Playwright end-to-end browser journeys
npm run test:e2e

# Run production bundle size audit (Budget: <= 130 KB gzip initial JS)
npm run check:bundle
```

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
