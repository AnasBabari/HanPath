import crypto from 'node:crypto';
import * as cookie from 'cookie';

const GUEST_COOKIE_NAME = 'hanpath_guest_id';
const DEFAULT_SECRET = 'hanpath-dev-guest-cookie-secret-min32chars!';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSecret(): string {
  const secret = process.env.GUEST_COOKIE_SECRET;
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  if (isProd) {
    if (!secret || secret.length < 32) {
      throw new Error(
        'Critical security configuration error: GUEST_COOKIE_SECRET must be set and at least 32 characters in production.'
      );
    }
    return secret;
  }

  return secret || DEFAULT_SECRET;
}

function getHmacSecret(): Buffer {
  const override = process.env.GUEST_HMAC_SECRET;
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  if (override && isProd && override.length < 32) {
    throw new Error('GUEST_HMAC_SECRET must be at least 32 characters in production.');
  }

  const rootSecret = override || getSecret();
  return crypto
    .createHmac('sha256', rootSecret)
    .update('hanpath:guest-network-fingerprint:v1')
    .digest();
}

/**
 * Sign a guest UUID with HMAC SHA-256
 */
export function signGuestId(guestId: string): string {
  const secret = getSecret();
  if (!UUID_REGEX.test(guestId)) {
    throw new Error('Invalid guest identifier format: UUID required');
  }
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
  if (!UUID_REGEX.test(guestId)) return null;

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
 * Generates an HMAC SHA-256 network fingerprint (subnet + user-agent) for secondary abuse prevention without storing raw IP.
 */
export function generateSecondaryAbuseFingerprint(
  forwardedFor?: string | null,
  userAgent?: string | null
): string | null {
  const rawIp = (forwardedFor?.split(',')[0] || '').trim();
  if (!rawIp) return null;

  // Mask last octet of IPv4 or last segments of IPv6 to create a privacy-safe subnet representation
  const ipv4Parts = rawIp.split('.');
  const subnet = ipv4Parts.length === 4 && ipv4Parts.every(part => /^\d{1,3}$/.test(part))
    ? `${ipv4Parts.slice(0, 3).join('.')}.0`
    : rawIp.includes(':')
      ? `${rawIp.split(':').slice(0, 4).join(':')}::`
      : null;
  if (!subnet) return null;

  const ua = (userAgent || '').slice(0, 200);

  return crypto
    .createHmac('sha256', getHmacSecret())
    .update(`${subnet}|${ua}`)
    .digest('hex');
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
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production';

  const serialized = cookie.serialize(GUEST_COOKIE_NAME, signed, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return { guestId: newGuestId, isNew: true, cookieHeader: serialized };
}
