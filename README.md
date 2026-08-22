<div align="center">
  <img src="public/favicon.svg" alt="HànPath Logo" width="80" height="80" />
  <h1>汉路 HànPath</h1>
  
  <p><strong>A modern, production-hardened Chinese learning platform with official HSK 3.0 curriculum, spaced repetition (SRS), graded stories, and pedagogical AI tutoring.</strong></p>

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

**HànPath** is built for learners mastering Mandarin Chinese with structural rigor, high performance, and offline resilience.

- 📚 **Official HSK 3.0 Standard (2021):** Exactly 500 HSK 1 words and 772 HSK 2 words (1,272 cumulative vocabulary items) pre-bundled with pinyin, English definitions, and interactive stroke order animations.
- 📖 **Original Graded Stories:** 8 original stories per level with tokenized glosses, character popups, and pinyin assistance.
- 🤖 **Pedagogical AI Language Buddy:** Serverless OpenRouter proxy with fallback routing, strict server-authored system prompts, and context isolation.
- ⚡ **Optimistic Concurrency & Local-First Sync:** Version-conditioned atomic cloud sync with guest-to-cloud merge, full offline persistence, and export/restore capabilities.
- 🔐 **Dual Auth Flows:** 6-digit email One-Time Passcode (OTP) and Google OAuth with PKCE redirection (`/auth/callback`).
- ⚡ **Ultra-Fast Performance:** Initial page-load bundle budget strictly enforced at **<= 130 KB gzip** with dynamic code-splitting.
- ♿ **Accessibility (a11y):** Full WCAG 2.1 AA compliance verified with automated axe-core audits.

---

## 🛠️ Architecture & Infrastructure

HànPath is designed natively for deployment on **Vercel** with serverless backend endpoints and a local-first **React 19 SPA**.

```text
Browser Client (React 19 + Vite 8 + Zustand)
  ├─ Local Storage (Strict ProgressSnapshotV4 & SRS Scheduling)
  ├─ /api/chat     ──> Serverless Vercel Function ──> OpenRouter Free Model Fallbacks
  ├─ /api/progress ──> Serverless Vercel Function ──> Supabase Postgres (RPC version predicate)
  ├─ /api/account  ──> Serverless Vercel Function ──> Supabase Admin API (Atomic user deletion)
  └─ /api/health   ──> Serverless Vercel Function ──> Health & Readiness Probe
```

### Key Technical Systems

1. **Authentication & Session Identity**
   - **Signed-in Users:** Authenticate via Supabase 6-digit email OTP or Google OAuth PKCE. Verified server-side via Bearer JWT tokens.
   - **Guest Users:** Stateless signed HMAC-SHA256 cookies (`hp_guest_sess`) ensure tamper-proof identity tracking and rate limiting without requiring early database writes.
   - **Fail-Closed Security:** Malformed or expired Bearer tokens return HTTP 401 without silent fallback to guest access.

2. **Atomic Cloud Sync & Version Predicate**
   - Progress uses a strict, versioned snapshot schema (`ProgressSnapshotV4`).
   - Mutations are committed locally immediately, then synchronized via `POST /api/progress` using version-conditioned atomic updates (`WHERE version = :expected_version`).
   - Conflicts return HTTP 409 with the current server envelope, enabling seamless client-side merging.

3. **Secured AI Chat Proxy**
   - Browser client never holds OpenRouter API keys.
   - 100% server-authored pedagogical system prompts prevent prompt injection.
   - Untrusted exercise context is segregated into dedicated structured messages.
   - 15-second total timeout deadline across all fallback models (`qwen3-4b`, `qwen3-coder`, `llama-3.2-3b`, `trinity-large`).
   - Strict origin validation, `application/json` Content-Type enforcement, and payload size bounds (max 10 messages, max 6,000 total characters).

4. **Distributed Quota Management**
   - Guests: 5 requests / day.
   - Authenticated: 50 requests / day.
   - Backed by atomic Postgres RPC `increment_ai_quota`. In production, failures fail closed (HTTP 503) to protect upstream providers.

---

## 📚 Curriculum & Stories Provenance

- **Curriculum:** Ministry of Education PRC GF0025-2021 Standard (*Chinese Proficiency Grading Standards for International Chinese Language Education*).
- **Exact Counts:** Exactly **500 HSK 1** words and **772 HSK 2** words (1,272 cumulative).
- **Integrity:** Validated against canonical SHA-256 hash `d9c33ef656dbd854bf9eb76ef635674ddeeac92de60264b70c84c7f370a01449`.
- **License:** CC-BY-4.0 / MIT (CC-CEDICT & MIT Open Chinese Lexicon).
- **Graded Stories:** 8 original stories for HSK 1 and 8 original stories for HSK 2 (16 total), structurally validated with automated tokenization and HSK-level vocabulary bounds.

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

# Clean dependency installation
npm ci

# Start the Vite development server
npm run dev
```

### 2. Environment Configuration
Create a `.env.local` file for local development:
```env
# Client-Side Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Serverless API Configuration (Vercel Functions)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GUEST_COOKIE_SECRET=your-secure-random-32-char-secret
APP_ORIGIN=https://your-production-app.vercel.app
```

---

## 🧪 Testing & Quality Gates

The project maintains 100% passing quality gates across all functional and security vectors:

```bash
# Run all quality checks (TypeScript, lint, all test suites, bundle budget)
npm run check

# Run unit and integration tests
npm run test:unit

# Run full code coverage report
npm run test:coverage

# Run axe-core accessibility tests
npm run test:a11y

# Run production bundle size audit (Budget: <= 130 KB gzip initial JS)
npm run check:bundle
```

---

## 🗄️ Database Migrations

Database schemas and stored procedures are organized in `supabase/migrations/`:
1. `20260822000001_initial_schema.sql`: Initial `user_progress` and `ai_usage` tables with Row Level Security.
2. `20260822000002_atomic_progress_and_deletion.sql`: Atomic version-conditioned updates, RPC quota counters, and cascade deletion policies.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
