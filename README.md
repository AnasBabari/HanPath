# HànPath (汉路) - v1

HànPath v1 is a React + TypeScript Chinese learning app focused on HSK 1-2 practice and short-story comprehension with AI-assisted learning.

## v1 Scope

- HSK 1-2 lesson exercises and graded stories
- AI chat and AI feedback via OpenRouter with free-model auto-routing
- Supabase-backed progress sync with local fallback cache
- XP/level/streak gamification and profile analytics

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Supabase (Auth + Postgres/RLS)
- OpenRouter Chat Completions API
- Web Speech API + Web Audio API

## Environment

Copy .env.example to .env and set:

- VITE_OPENROUTER_API_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- Optional: VITE_OPENROUTER_FREE_MODELS

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Database Notes

- Progress is stored in Supabase table public.user_progress.
- Anonymous auth must be enabled.
- RLS policies must allow users to select/insert/update only their own row.

## Next Update (Planned)

- HSK 3, HSK 4, and HSK 5 exercise sets
- HSK 3-5 graded stories
- Additional quality and performance improvements across content, UX, and sync behavior
