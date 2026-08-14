import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Supabase Database Threat Model & SQL Policy Verification', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');

  it('verifies schema.sql exists and enforces strict Row Level Security', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // 1. RLS is explicitly enabled
    expect(sql).toContain('ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;');

    // 2. Strict User Isolation Policies
    // User A can read, insert, update, delete own progress with auth.uid() = user_id
    expect(sql).toMatch(/CREATE POLICY "Users can view their own progress"\s+ON public\.user_progress\s+FOR SELECT\s+USING \(auth\.uid\(\) = user_id\);/i);
    expect(sql).toMatch(/CREATE POLICY "Users can insert their own progress"\s+ON public\.user_progress\s+FOR INSERT\s+WITH CHECK \(auth\.uid\(\) = user_id\);/i);
    expect(sql).toMatch(/CREATE POLICY "Users can update their own progress"\s+ON public\.user_progress\s+FOR UPDATE\s+USING \(auth\.uid\(\) = user_id\)\s+WITH CHECK \(auth\.uid\(\) = user_id\);/i);
    expect(sql).toMatch(/CREATE POLICY "Users can delete their own progress"\s+ON public\.user_progress\s+FOR DELETE\s+USING \(auth\.uid\(\) = user_id\);/i);
  });

  it('guarantees leaderboard view never exposes private JSONB stats or raw auth UUIDs', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // 1. Leaderboard view definition
    expect(sql).toContain('CREATE VIEW public.leaderboard');

    // 2. Uses public_id pseudonym instead of raw auth.users(id)
    expect(sql).toContain('public_id');
    expect(sql).not.toContain('SELECT\n    user_id,\n');

    // 3. raw stats JSONB document is NEVER in the projection (only explicit aggregate keys)
    expect(sql).not.toMatch(/CREATE VIEW public\.leaderboard[^;]*\bSELECT\b[^;]*\bstats\s*,/i);
    expect(sql).not.toMatch(/CREATE VIEW public\.leaderboard[^;]*\bSELECT\s+\*/i);
    // Only aggregate numbers are extracted (total_xp, level)
    expect(sql).toContain('AS total_xp');
    expect(sql).toContain('AS level');
  });

  it('enforces automatic updated_at trigger maintenance', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.handle_updated_at()');
    expect(sql).toContain('BEFORE UPDATE ON public.user_progress');
    expect(sql).toContain('EXECUTE FUNCTION public.handle_updated_at()');
  });
});
