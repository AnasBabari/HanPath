import { resolveGuestSession } from './guest.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

export interface ResolvedIdentity {
  type: 'user' | 'guest';
  userId: string | null;
  identifier: string; // e.g. "user:<uuid>" or "guest:<uuid>"
  guestCookieHeader: string | null;
}

/**
 * Resolves request identity from Authorization header or signed guest cookie
 */
export async function resolveIdentity(
  authHeader?: string | null,
  cookieHeader?: string | null
): Promise<ResolvedIdentity> {
  // Check for Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (!error && user?.id) {
            return {
              type: 'user',
              userId: user.id,
              identifier: `user:${user.id}`,
              guestCookieHeader: null,
            };
          }
        } catch {
          // Token validation failed; fall back to guest
        }
      }
    }
  }

  // Resolve signed guest session
  const { guestId, cookieHeader: newCookie } = resolveGuestSession(cookieHeader);
  return {
    type: 'guest',
    userId: null,
    identifier: `guest:${guestId}`,
    guestCookieHeader: newCookie,
  };
}
