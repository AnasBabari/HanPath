import { resolveGuestSession } from './guest.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

export interface ResolvedIdentity {
  type: 'user' | 'guest' | 'unauthorized';
  userId: string | null;
  identifier: string; // e.g. "user:<uuid>", "guest:<uuid>"
  guestCookieHeader: string | null;
  error?: string;
}

/**
 * Resolves request identity from Authorization header or signed guest cookie.
 * If an Authorization header is provided, it MUST be valid; invalid credentials return unauthorized.
 */
export async function resolveIdentity(
  authHeader?: string | null,
  cookieHeader?: string | null
): Promise<ResolvedIdentity> {
  // If Authorization header is provided, strictly evaluate it
  if (authHeader !== undefined && authHeader !== null && authHeader.trim() !== '') {
    if (!authHeader.startsWith('Bearer ')) {
      return {
        type: 'unauthorized',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        error: 'Malformed Authorization header. Format must be "Bearer <token>"',
      };
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return {
        type: 'unauthorized',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        error: 'Empty bearer token provided',
      };
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return {
        type: 'unauthorized',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        error: 'Authentication service unavailable',
      };
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user?.id) {
        return {
          type: 'unauthorized',
          userId: null,
          identifier: '',
          guestCookieHeader: null,
          error: error?.message || 'Invalid or expired bearer token',
        };
      }

      return {
        type: 'user',
        userId: user.id,
        identifier: `user:${user.id}`,
        guestCookieHeader: null,
      };
    } catch (err: unknown) {
      return {
        type: 'unauthorized',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        error: err instanceof Error ? err.message : 'Authentication verification failed',
      };
    }
  }

  // Authorization header was absent: resolve signed guest session
  const { guestId, cookieHeader: newCookie } = resolveGuestSession(cookieHeader);
  return {
    type: 'guest',
    userId: null,
    identifier: `guest:${guestId}`,
    guestCookieHeader: newCookie,
  };
}
