<div align="center">
  <img src="public/favicon.svg" alt="HànPath Logo" width="80" height="80" />
  <h1>汉路 HànPath</h1>
  
  <p><strong>A modern Chinese learning platform with community-curated HSK 3.0-aligned vocabulary, spaced repetition (SRS), graded stories, and pedagogical AI tutoring.</strong></p>

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

- 📚 **HSK 3.0-aligned vocabulary:** all 506 level-1 and 750 level-2 entries (1,256 cumulative) from the pinned upstream v1.4 lists, with HanPath pedagogical corrections, pinyin, English definitions, and stroke-order practice.
- 📖 **16 Graded Stories:** 8 coherent narrative stories per level with tokenized glosses, character popups, and pinyin assistance.
- 🤖 **Pedagogical AI Language Buddy:** Serverless OpenRouter proxy with fallback routing, strict server-authored system prompts, and context isolation.
- ⚡ **Optimistic Concurrency & Local-First Sync:** Version-conditioned atomic cloud sync with guest-to-cloud merge, full offline persistence, and export/restore capabilities.
- 🔐 **Dual Auth Flows:** 6-digit email One-Time Passcode (OTP) and Google OAuth with PKCE redirection (`/auth/callback`).
- ⚡ **Ultra-Fast Performance:** Initial page-load bundle budget strictly enforced at **<= 130 KB gzip** with dynamic code-splitting.
- ♿ **Accessibility (a11y):** Automated jsdom and real-browser axe-core checks plus keyboard-navigation coverage. These checks reduce risk but are not a formal WCAG conformance certification.

---

## 🛠️ Architecture & Infrastructure

HànPath is designed natively for deployment on **Vercel** with serverless backend endpoints and a local-first **React 19 SPA**.

```text
Browser Client (React 19 + Vite 8 + Zustand)
  ├─ Local Storage (Strict ProgressSnapshotV4 & SRS Scheduling)
  ├─ /api/chat     ──> Serverless Vercel Function ──> OpenRouter Free Model Fallbacks
  ├─ /api/progress ──> Serverless Vercel Function ──> Supabase Postgres (RPC version predicate)
  ├─ /api/account  ──> Serverless Vercel Function ──> Supabase Auth + PostgreSQL FK cascades
  └─ /api/health   ──> Serverless Vercel Function ──> Health & Readiness Probe
```

### Key Technical Systems

1. **Authentication & Session Identity**
   - **Signed-in Users:** Authenticate via Supabase 6-digit email OTP or Google OAuth PKCE. Verified server-side via Bearer JWT tokens.
   - **Guest Users:** Stateless signed HMAC-SHA256 cookies (`hanpath_guest_id`) ensure tamper-proof identity tracking and rate limiting without requiring early database writes.
   - **Fail-Closed Security:** Malformed or expired Bearer tokens return HTTP 401 without silent fallback to guest access.

2. **Atomic Cloud Sync & Version Predicate**
   - Progress uses a strict, versioned snapshot schema (`ProgressSnapshotV4`).
   - Mutations are committed locally immediately, then synchronized via `PUT /api/progress` using a version-conditioned PostgreSQL RPC.
   - Conflicts return HTTP 409 with the current server envelope, enabling seamless client-side merging.

3. **Secured AI Chat Proxy**
   - Browser client never holds OpenRouter API keys.
   - Server-authored pedagogical system prompts and constrained context reduce prompt-injection exposure.
   - Untrusted exercise context is segregated into dedicated structured messages.
   - 15-second total timeout deadline across all fallback models (`qwen3-4b`, `qwen3-coder`, `llama-3.2-3b`, `trinity-large`).
   - Strict origin validation, `application/json` Content-Type enforcement, and payload size bounds (max 10 messages, max 6,000 total characters).

4. **Distributed Quota Management**
   - Guests: 5 requests / day.
   - Authenticated: 50 requests / day.
   - Backed by the atomic Postgres RPC `record_and_check_ai_quota`. Guests also receive a privacy-preserving subnet/user-agent HMAC quota bucket to limit cookie rotation. Production storage failures fail closed with HTTP 503.

---

## 📚 Curriculum & Stories Provenance

- **Status:** Community-curated, HSK 3.0-aligned learning content—not an official CTI/CLEC publication or certification.
- **Normalized Dataset Source:** `drkameleon/complete-hsk-vocabulary` release v1.4, pinned to commit `7ac65bf1a6387d35f1ade478906172a19311c7f9`, with HanPath pedagogical overrides. The upstream release describes these lists as aligned to the 2026 examination syllabus; GF0025-2021 and the [CTI HSK site](https://www.chinesetest.cn/HSK) are reference standards.
- **Exact Pinned Counts:** **506 level-1** entries and **750 level-2** entries (1,256 cumulative); the generator fails if the immutable source does not match.
- **Integrity Checksum:** A deterministic SHA-256 checksum is embedded in and verified against the generated artifact.
- **License:** MIT License.
- **Graded Stories:** 8 stories per level (16 total), with curriculum words verified against the generated artifact and a bounded set of explicitly marked, individually glossed support words. Automated review metadata does not imply external human editorial certification.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `20.x`
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

The required CI gates cover linting, type checks, unit/API tests, coverage, build and bundle budgets, PostgreSQL migration execution, browser E2E, accessibility smoke checks, and dependency audit:

```bash
# Run all quality checks (TypeScript, lint, all test suites, bundle budget)
npm run check

# Run unit and integration tests
npm run test:unit

# Run full code coverage report
npm run test:coverage

# Run axe-core accessibility tests
npm run test:a11y

# Run API-focused tests
npm run test:api

# Build and run real-browser journeys
npm run test:e2e

# Run production bundle size audit (Budget: <= 130 KB gzip initial JS)
npm run check:bundle
```

---

## 🗄️ Database Migrations

Database schemas and stored procedures are organized in `supabase/migrations/`:
1. `20260822000001_initial_schema.sql`: Initial `user_progress` and `ai_usage` tables with Row Level Security.
2. `20260822000002_atomic_progress_and_deletion.sql`: Version-conditioned progress and legacy deletion functions.
3. `20260822140000_secure_user_functions.sql`: Fixed search paths and service-role-only stored procedures.
4. `20260822160000_atomic_auth_cascade_deletion.sql`: Validated Auth foreign-key cascades, authenticated quota ownership, and removal of the unsafe two-step deletion function.

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
