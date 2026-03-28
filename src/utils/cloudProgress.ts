import type { UserStats } from '../types';
import { getSupabaseClient } from './supabase';

const TABLE = 'user_progress';

export async function initCloudProgress(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (session?.user?.id) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;

  return data.user?.id ?? null;
}

export async function loadCloudProgress(userId: string): Promise<UserStats | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error, status } = await supabase
    .from(TABLE)
    .select('stats')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && status !== 406) throw error;
  if (!data?.stats) return null;

  return data.stats as UserStats;
}

export async function saveCloudProgress(userId: string, stats: UserStats): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      stats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}

export async function clearCloudProgress(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
}
