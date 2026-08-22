import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Supabase Database Threat Model & SQL Policy Verification (v4)', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');

  it('verifies schema.sql exists and enforces strict Row Level Security', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // 1. RLS is explicitly enabled
    expect(sql).toContain('ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;');
  });

  it('verifies direct access is revoked from anon and authenticated roles', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');

    expect(sql).toContain('REVOKE ALL ON public.user_progress FROM anon, authenticated, public;');
    expect(sql).toContain('REVOKE ALL ON public.ai_usage FROM anon, authenticated, public;');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.record_and_check_ai_quota FROM anon, authenticated, public;');

    // Exclusive service_role grants for serverless backend
    expect(sql).toContain('GRANT ALL ON public.user_progress TO service_role;');
    expect(sql).toContain('GRANT ALL ON public.ai_usage TO service_role;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.record_and_check_ai_quota TO service_role;');
  });

  it('verifies leaderboard is completely dropped', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toContain('DROP VIEW IF EXISTS public.leaderboard;');
  });

  it('enforces automatic updated_at trigger maintenance and atomic quota function', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.handle_updated_at()');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_and_check_ai_quota');
    expect(sql).toContain('FOR UPDATE');
  });
});
