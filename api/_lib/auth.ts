import { resolveGuestSession, generateSecondaryAbuseFingerprint } from './guest.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

export interface ResolvedIdentity {
  type: 'user' | 'guest' | 'unauthorized' | 'unavailable';
  userId: string | null;
  identifier: string; // e.g. "user:<uuid>", "guest:<uuid>"
  guestCookieHeader: string | null;
  fingerprint?: string;
  error?: string;
}

/**
 * Resolves request identity from Authorization header or signed guest cookie.
 * If an Authorization header is provided, it MUST be valid; invalid credentials return unauthorized.
 */
export async function resolveIdentity(
  authHeader?: string | null,
  cookieHeader?: string | null,
  clientIp?: string | null,
  userAgent?: string | null
): Promise<ResolvedIdentity> {
  const fingerprint = generateSecondaryAbuseFingerprint(clientIp, userAgent) || undefined;

  // If Authorization header is provided, strictly evaluate it
  if (authHeader !== undefined && authHeader !== null && authHeader.trim() !== '') {
    if (!authHeader.startsWith('Bearer ')) {
      return {
        type: 'unauthorized',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        fingerprint,
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
        fingerprint,
        error: 'Empty bearer token provided',
      };
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return {
        type: 'unavailable',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        fingerprint,
        error: 'Authentication service is temporarily unavailable',
      };
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user?.id) {
        const status = Number((error as { status?: number } | null)?.status);
        if (Number.isFinite(status) && (status === 0 || status >= 500)) {
          return {
            type: 'unavailable',
            userId: null,
            identifier: '',
            guestCookieHeader: null,
            fingerprint,
            error: 'Authentication service is temporarily unavailable',
          };
        }
        return {
          type: 'unauthorized',
          userId: null,
          identifier: '',
          guestCookieHeader: null,
          fingerprint,
          error: 'Invalid or expired bearer token',
        };
      }

      return {
        type: 'user',
        userId: user.id,
        identifier: `user:${user.id}`,
        guestCookieHeader: null,
        fingerprint,
      };
    } catch {
      return {
        type: 'unavailable',
        userId: null,
        identifier: '',
        guestCookieHeader: null,
        fingerprint,
        error: 'Authentication service is temporarily unavailable',
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
    fingerprint,
  };
}
