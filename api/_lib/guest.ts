import crypto from 'node:crypto';
import * as cookie from 'cookie';

const GUEST_COOKIE_NAME = 'hanpath_guest_id';
const DEFAULT_SECRET = 'hanpath-dev-guest-cookie-secret-min32chars!';

function getSecret(): string {
  return process.env.GUEST_COOKIE_SECRET || DEFAULT_SECRET;
}

/**
 * Sign a guest UUID with HMAC SHA-256
 */
export function signGuestId(guestId: string): string {
  const secret = getSecret();
  const signature = crypto.createHmac('sha256', secret).update(guestId).digest('base64url');
  return `${guestId}.${signature}`;
}

/**
 * Verify a signed guest cookie and extract the guest UUID
 */
export function verifyGuestId(signedValue: string): string | null {
  if (!signedValue || typeof signedValue !== 'string') return null;
  const parts = signedValue.split('.');
  if (parts.length !== 2) return null;

  const [guestId, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(guestId).digest('base64url');

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSig, 'utf8')
    );
    return valid ? guestId : null;
  } catch {
    return null;
  }
}

/**
 * Extract or generate a signed guest identifier from request Cookie header
 */
export function resolveGuestSession(cookieHeader?: string | null): {
  guestId: string;
  isNew: boolean;
  cookieHeader: string | null;
} {
  const cookies = cookie.parse(cookieHeader || '');
  const rawCookie = cookies[GUEST_COOKIE_NAME];

  if (rawCookie) {
    const verified = verifyGuestId(rawCookie);
    if (verified) {
      return { guestId: verified, isNew: false, cookieHeader: null };
    }
  }

  // Generate new secure guest UUID and sign
  const newGuestId = crypto.randomUUID();
  const signed = signGuestId(newGuestId);
  const isProd = process.env.NODE_ENV === 'production';

  const serialized = cookie.serialize(GUEST_COOKIE_NAME, signed, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return { guestId: newGuestId, isNew: true, cookieHeader: serialized };
}
