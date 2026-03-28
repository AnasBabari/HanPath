# HànPath (汉路)

A personal-use, Duolingo-style Chinese learning app focused on practical reading, listening, and speaking momentum.

## Highlights

- AI-powered chat and feedback via OpenRouter
- Auto-router that cycles through free models until one responds
- Interactive HSK stories with click-to-translate flow
- Practical-first HSK curriculum ordering
- Flashcard review with spaced repetition support
- XP, levels, streaks, and achievements
- Local-first persistence for progress and settings

## Tech Stack

- React + TypeScript
- Vite
- OpenRouter Chat Completions API
- Web Speech API (TTS)
- Web Audio API (SFX)

## Environment Setup

1. Copy .env.example to .env.
2. Add your OpenRouter API key.
3. Optionally define your own prioritized free model list.

Required variable:

- VITE_OPENROUTER_API_KEY
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Optional variable:

- VITE_OPENROUTER_FREE_MODELS

Example:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-your-key
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENROUTER_FREE_MODELS=arcee-ai/trinity-large-preview:free,qwen/qwen3-4b:free,qwen/qwen3-coder:free
```

## Supabase Progress Storage Setup

Enable Anonymous auth in Supabase Authentication -> Providers, then run this SQL:

```sql
create table if not exists public.user_progress (
	user_id uuid primary key references auth.users(id) on delete cascade,
	stats jsonb not null default '{}'::jsonb,
	updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

create policy progress_select_own
on public.user_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy progress_insert_own
on public.user_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy progress_update_own
on public.user_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

If anonymous sign-in fails with a captcha verification error during testing, disable CAPTCHA for Anonymous sign-ins in Supabase Auth settings.

## OpenRouter Auto-Routing Behavior

When chat runs in auto/free mode, the app:

1. Reads your optional VITE_OPENROUTER_FREE_MODELS list.
2. Merges it with built-in fallback free models.
3. Pulls the latest free model catalog from OpenRouter.
4. Tries models one by one until one succeeds.
5. Stores the last working free model in local storage and prioritizes it next time.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (typically http://localhost:5173).

## Production Build

```bash
npm run build
npm run preview
```

## Data Storage

Progress sync uses Supabase (user_progress table) and keeps local browser storage as a fallback/cache.

Relevant keys include:

- hanpath-progress-v2
- hanpath-last-working-free-model

To reset learning data, open Profile and use Reset Everything, or clear local storage manually in DevTools.
