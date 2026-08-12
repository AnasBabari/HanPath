import type { UserStats } from '../types';
import { getSupabaseClient } from './supabase';

const k = (a: string, b: string) => `${a}_${b}`;
const TABLE = k('user', 'progress');
const COL_USER_ID = k('user', 'id');
const COL_STATS = 'stats';
const COL_UPDATED_AT = k('updated', 'at');
const LOCAL_PROGRESS_UPDATED_AT_KEY = 'hanpath-progress-updated-at-v1';

export interface CloudProgress {
  stats: UserStats;
  updatedAt: string;
}

export type ProgressSource = 'local' | 'cloud' | 'none';

export function getLocalProgressUpdatedAt(): string | null {
  try {
    return localStorage.getItem(LOCAL_PROGRESS_UPDATED_AT_KEY);
  } catch {
    return null;
  }
}

export function setLocalProgressUpdatedAt(value: string): void {
  try {
    localStorage.setItem(LOCAL_PROGRESS_UPDATED_AT_KEY, value);
  } catch {
    // Local storage is optional; cloud sync still remains available.
  }
}

function timestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function reconcileProgress(
  localStats: UserStats,
  localUpdatedAt: string | null,
  cloudProgress: CloudProgress | null,
): { stats: UserStats; updatedAt: string; source: ProgressSource } {
  if (!cloudProgress) {
    const updatedAt = localUpdatedAt && timestampMs(localUpdatedAt) > 0
      ? localUpdatedAt
      : new Date().toISOString();
    return { stats: localStats, updatedAt, source: 'local' };
  }

  // A strictly newer local snapshot wins. Ties deliberately prefer cloud so two
  // devices converge instead of repeatedly overwriting each other.
  if (timestampMs(localUpdatedAt) > timestampMs(cloudProgress.updatedAt)) {
    return {
      stats: localStats,
      updatedAt: localUpdatedAt as string,
      source: 'local',
    };
  }

  return {
    stats: cloudProgress.stats,
    updatedAt: cloudProgress.updatedAt,
    source: 'cloud',
  };
}

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

export async function loadCloudProgress(userId: string): Promise<CloudProgress | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: rawData, error, status } = await supabase
    .from(TABLE)
    .select('stats, updated_at')
    .eq(COL_USER_ID, userId)
    .maybeSingle();

  const data = rawData as { stats?: unknown; updated_at?: unknown } | null;
  if (error && status !== 406) throw error;
  if (!data?.stats || typeof data.updated_at !== 'string') return null;

  return { stats: data.stats as UserStats, updatedAt: data.updated_at };
}

export async function saveCloudProgress(
  userId: string,
  stats: UserStats,
  updatedAt = new Date().toISOString(),
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const payload: Record<string, unknown> = {
    [COL_STATS]: stats,
    [COL_UPDATED_AT]: updatedAt,
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
    .select(`${COL_USER_ID}, total_xp, level`)
    .order(COL_UPDATED_AT, { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const rows = data as unknown as Array<{
    user_id: string;
    total_xp?: number;
    level?: number;
  }>;
  const entries: LeaderboardEntry[] = rows.map((row) => {
    return {
      userId: row.user_id,
      totalXP: Number.isFinite(row.total_xp) ? Number(row.total_xp) : 0,
      level: Number.isFinite(row.level) ? Number(row.level) : 1,
    };
  });

  return entries.sort((a, b) => b.totalXP - a.totalXP).slice(0, 20);
}
