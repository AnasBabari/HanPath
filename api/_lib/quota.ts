import type { QuotaResult } from './types.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

// Quota Constants
export const QUOTA_LIMITS = {
  guest: { daily: 5, minute: 5 },
  user: { daily: 50, minute: 10 },
} as const;

// In-memory fallback for local dev / testing without live Supabase
interface MemoryQuotaBucket {
  dailyCount: number;
  minuteCount: number;
  lastResetDay: string;
  lastResetMinute: number;
}

const memoryStore = new Map<string, MemoryQuotaBucket>();

function checkMemoryQuota(
  identifier: string,
  maxDaily: number,
  maxMinute: number
): QuotaResult {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMinute = Math.floor(now.getTime() / 60000);

  let bucket = memoryStore.get(identifier);
  if (!bucket) {
    bucket = {
      dailyCount: 0,
      minuteCount: 0,
      lastResetDay: todayStr,
      lastResetMinute: currentMinute,
    };
    memoryStore.set(identifier, bucket);
  }

  // Reset day if needed
  if (bucket.lastResetDay !== todayStr) {
    bucket.dailyCount = 0;
    bucket.lastResetDay = todayStr;
  }

  // Reset minute if needed
  if (bucket.lastResetMinute !== currentMinute) {
    bucket.minuteCount = 0;
    bucket.lastResetMinute = currentMinute;
  }

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const resetAt = tomorrow.toISOString();

  if (bucket.dailyCount >= maxDaily) {
    return {
      allowed: false,
      limit: maxDaily,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.ceil((tomorrow.getTime() - now.getTime()) / 1000),
    };
  }

  if (bucket.minuteCount >= maxMinute) {
    const nextMinuteMs = (currentMinute + 1) * 60000;
    return {
      allowed: false,
      limit: maxDaily,
      remaining: Math.max(0, maxDaily - bucket.dailyCount),
      resetAt,
      retryAfterSeconds: Math.ceil((nextMinuteMs - now.getTime()) / 1000),
    };
  }

  bucket.dailyCount += 1;
  bucket.minuteCount += 1;

  return {
    allowed: true,
    limit: maxDaily,
    remaining: Math.max(0, maxDaily - bucket.dailyCount),
    resetAt,
  };
}

export class QuotaStoreUnavailableError extends Error {
  constructor(message = 'Distributed quota storage is currently unavailable') {
    super(message);
    this.name = 'QuotaStoreUnavailableError';
  }
}

/**
 * Checks and records AI quota atomically via Supabase RPC or memory fallback in development
 */
export async function checkAndRecordQuota(
  identifier: string,
  isGuest: boolean
): Promise<QuotaResult> {
  const limits = isGuest ? QUOTA_LIMITS.guest : QUOTA_LIMITS.user;
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  const supabase = getSupabaseAdmin();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('record_and_check_ai_quota', {
        p_identifier: identifier,
        p_max_daily: limits.daily,
        p_max_minute: limits.minute,
      });

      if (!error && data && typeof data === 'object') {
        const result = data as {
          allowed: boolean;
          remaining_daily: number;
          retry_after_seconds?: number;
          reset_at?: string;
        };

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);

        return {
          allowed: Boolean(result.allowed),
          limit: limits.daily,
          remaining: Math.max(0, Number(result.remaining_daily ?? 0)),
          resetAt: result.reset_at || tomorrow.toISOString(),
          retryAfterSeconds: result.retry_after_seconds ? Number(result.retry_after_seconds) : undefined,
        };
      }

      if (isProd) {
        throw new QuotaStoreUnavailableError(
          `Quota RPC returned error: ${error?.message || 'Invalid RPC response'}`
        );
      }
    } catch (err: unknown) {
      if (isProd) {
        if (err instanceof QuotaStoreUnavailableError) throw err;
        throw new QuotaStoreUnavailableError(
          `Quota store failed in production: ${err instanceof Error ? err.message : 'Database error'}`
        );
      }
      // In dev/test, fall through to memory bucket
    }
  } else if (isProd) {
    throw new QuotaStoreUnavailableError('Supabase admin client unavailable in production');
  }

  return checkMemoryQuota(identifier, limits.daily, limits.minute);
}
