import type { UserStats } from '../types';
import { getSupabaseClient } from './supabase';

const k = (a: string, b: string) => `${a}_${b}`;
const TABLE = k('user', 'progress');
const COL_USER_ID = k('user', 'id');
const COL_STATS = 'stats';
const COL_UPDATED_AT = k('updated', 'at');

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
      console.error('Supabase Auth Error: Captcha verification failed.');
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
    .select(COL_STATS)
    .eq(COL_USER_ID, userId)
    .maybeSingle();

  if (error && status !== 406) throw error;
  if (!data?.stats) return null;

  return data.stats as UserStats;
}

export async function saveCloudProgress(userId: string, stats: UserStats): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const payload: Record<string, any> = {
    [COL_STATS]: stats,
    [COL_UPDATED_AT]: new Date().toISOString(),
    [COL_USER_ID]: userId,
  };

  const { error } = await supabase.from(TABLE).upsert(
    payload,
    { onConflict: COL_USER_ID }
  );

  if (error) throw error;
}

export async function clearCloudProgress(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).delete().eq(COL_USER_ID, userId);
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

  const { data, error } = await supabase
    .from('leaderboard')
    .select(`${COL_USER_ID}, ${COL_STATS}`)
    .order(COL_UPDATED_AT, { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const entries: LeaderboardEntry[] = data.map((d: any) => ({
    userId: d[COL_USER_ID],
    totalXP: d.stats?.totalXP || 0,
    level: d.stats?.level || 1,
  }));

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

  return entries.sort((a, b) => b.totalXP - a.totalXP).slice(0, 20);
}
