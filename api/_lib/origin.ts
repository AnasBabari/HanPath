function normalizeOrigin(value: string): string | null {
  const candidate = value.trim().replace(/\/$/, '');
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function vercelOrigin(value?: string): string | null {
  if (!value) return null;
  return normalizeOrigin(value.includes('://') ? value : `https://${value}`);
}

/**
 * Exact browser-origin allowlist. Vercel preview hosts are accepted only when
 * Vercel itself supplies the matching deployment/branch environment value.
 */
export function isAllowedOrigin(origin?: string | null): boolean {
  // Origin is not an authentication mechanism. Non-browser clients may omit it.
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized || normalized !== origin.replace(/\/$/, '')) return false;

  const allowed = new Set<string>();
  const configuredOrigins = (process.env.APP_ORIGIN || '').split(',');
  for (const configured of configuredOrigins) {
    const value = normalizeOrigin(configured);
    if (value) allowed.add(value);
  }

  for (const value of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    const resolved = vercelOrigin(value);
    if (resolved) allowed.add(resolved);
  }

  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (!isProduction) {
    allowed.add('http://localhost:5173');
    allowed.add('http://localhost:4173');
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://127.0.0.1:4173');
  }

  return allowed.has(normalized);
}
