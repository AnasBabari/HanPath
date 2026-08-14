import {
  buildPedagogicalSystemPrompt,
  validateChatRequest,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  UPSTREAM_TIMEOUT_MS,
  type EducationalChatRequest,
} from '../src/shared/chatContract';

interface ApiRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: Record<string, unknown>): void;
  setHeader?(name: string, value: string | number): void;
}

const RATE_LIMIT_MAX_KEYS = 1_000;
const rateLimiters = new Map<string, { count: number; resetAt: number }>();

function headerValue(req: ApiRequest, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function clientKey(req: ApiRequest): string {
  // Check authorization header first for authenticated users to avoid NAT IP collision
  const auth = headerValue(req, 'authorization');
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.length > 20) {
      return `auth:${token.slice(0, 32)}`;
    }
  }

  const forwarded = headerValue(req, 'x-forwarded-for');
  if (forwarded) return `ip:${forwarded.split(',')[0].trim().slice(0, 128) || 'unknown'}`;
  return `ip:${headerValue(req, 'x-real-ip')?.slice(0, 128) || 'unknown'}`;
}

function rateLimit(req: ApiRequest, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const key = clientKey(req);
  const current = rateLimiters.get(key);
  if (!current || current.resetAt <= now) {
    if (rateLimiters.size >= RATE_LIMIT_MAX_KEYS) {
      for (const [entryKey, entry] of rateLimiters) {
        if (entry.resetAt <= now) rateLimiters.delete(entryKey);
      }
      if (rateLimiters.size >= RATE_LIMIT_MAX_KEYS) rateLimiters.clear();
    }
    rateLimiters.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

export function resetChatRateLimits(): void {
  rateLimiters.clear();
}

function parseBody(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    res.status(405).json({ code: 'method_not_allowed', error: 'Method not allowed' });
    return;
  }

  const limit = rateLimit(req);
  if (!limit.allowed) {
    res.setHeader?.('Retry-After', limit.retryAfter);
    res.status(429).json({
      code: 'rate_limited',
      error: 'You have reached the AI question limit for this minute. Please wait a moment before trying again.',
      retry_after_seconds: limit.retryAfter,
    });
    return;
  }

  const parsed = parseBody(req.body);
  const validation = validateChatRequest(parsed);
  if (!validation.valid || !validation.sanitized) {
    res.status(400).json({ code: 'invalid_request', error: validation.error || 'Invalid chat request' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      code: 'ai_not_configured',
      error: 'AI assistant service is currently unconfigured. Lessons and flashcard review remain fully functional.',
    });
    return;
  }

  const payload: EducationalChatRequest = validation.sanitized;
  const systemInstruction = buildPedagogicalSystemPrompt(payload.context);

  const openRouterBody = {
    model: payload.model,
    messages: [
      { role: 'system', content: systemInstruction },
      ...payload.messages,
    ],
    temperature: payload.temperature,
    max_tokens: payload.max_tokens,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://hanpath.com',
        'X-Title': 'HànPath Learning App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openRouterBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      if (response.status === 429) {
        res.status(429).json({
          code: 'upstream_rate_limit',
          error: 'Upstream AI provider is temporarily busy. Please try again shortly.',
        });
        return;
      }
      res.status(502).json({
        code: 'upstream_error',
        error: 'Upstream AI service encountered an error.',
      });
      return;
    }

    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      res.status(502).json({
        code: 'invalid_upstream_response',
        error: 'Upstream AI returned an invalid response format.',
      });
      return;
    }

    res.status(200).json(data as Record<string, unknown>);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({
        code: 'gateway_timeout',
        error: 'AI request timed out. Please try asking a shorter question.',
      });
      return;
    }
    res.status(502).json({
      code: 'network_error',
      error: 'Unable to reach the upstream AI service.',
    });
  }
}
