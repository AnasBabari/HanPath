import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Supabase Database Threat Model & SQL Policy Verification (v4)', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase', 'schema.sql');
  const migrationPath = path.resolve(process.cwd(), 'supabase', 'migrations', '20260822140000_secure_user_functions.sql');
  const cascadeMigrationPath = path.resolve(process.cwd(), 'supabase', 'migrations', '20260822160000_atomic_auth_cascade_deletion.sql');

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
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.record_and_check_ai_quota FROM anon, authenticated, public;');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.save_user_progress FROM anon, authenticated, public;');

    // Exclusive service_role grants for serverless backend
    expect(sql).toContain('GRANT ALL ON public.user_progress TO service_role;');
    expect(sql).toContain('GRANT ALL ON public.ai_usage TO service_role;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.record_and_check_ai_quota TO service_role;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.save_user_progress TO service_role;');
  });

  it('ties authenticated application data to auth.users with cascade deletion', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const migrationSql = fs.readFileSync(cascadeMigrationPath, 'utf8');

    expect(sql).toContain('REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(sql).toContain('user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(migrationSql).toContain('FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE');
    expect(migrationSql).toContain('DROP FUNCTION IF EXISTS public.delete_user_data(UUID);');
  });

  it('verifies search_path protection on all SECURITY DEFINER functions', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8').replace(/\r\n/g, '\n');
    const migSql = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');

    // All SECURITY DEFINER functions must set search_path = ''
    expect(sql).toContain("SECURITY DEFINER\nSET search_path = ''");
    expect(migSql).toContain("SECURITY DEFINER\nSET search_path = ''");
  });

  it('verifies leaderboard is completely dropped', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    expect(sql).toContain('DROP VIEW IF EXISTS public.leaderboard;');
  });
});
