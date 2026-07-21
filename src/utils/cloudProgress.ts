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
  if (error) {
    if (error.message.toLowerCase().includes('captcha')) {
      console.error('Supabase Auth Error: Captcha verification failed. Please disable "Enable Captcha" for Anonymous sign-ins in your Supabase Dashboard (Authentication -> Providers -> Anonymous).');
    }
    throw error;
  }

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

export interface LeaderboardEntry {
  userId: string;
  totalXP: number;
  level: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  // Since Supabase JSONB sorting can be tricky to type safely in JS client without cast,
  // we'll fetch the top 100 based on recent updates and sort in memory for this prototype.
  const { data, error } = await supabase
    .from(TABLE)
    .select('user_id, stats')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const entries: LeaderboardEntry[] = data.map(d => ({
    userId: d.user_id,
    totalXP: d.stats?.totalXP || 0,
    level: d.stats?.level || 1,
  }));

  // If we have very few entries, add some fun mock ones to make it look alive
  if (entries.length < 5) {
    const mocks: LeaderboardEntry[] = [
      { userId: 'm1', totalXP: 2450, level: 12 },
      { userId: 'm2', totalXP: 1820, level: 9 },
      { userId: 'm3', totalXP: 1200, level: 7 },
      { userId: 'm4', totalXP: 850, level: 5 },
      { userId: 'm5', totalXP: 420, level: 3 },
    ];
    entries.push(...mocks);
  }

  // Sort descending by XP, return top 20
  return entries.sort((a, b) => b.totalXP - a.totalXP).slice(0, 20);
}
