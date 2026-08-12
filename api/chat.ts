type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatBody {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

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

const ALLOWED_MODELS = new Set([
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemma-2-9b-it:free',
]);
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOKENS = 1_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_MAX_KEYS = 1_000;
const rateLimiters = new Map<string, { count: number; resetAt: number }>();

function headerValue(req: ApiRequest, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function clientKey(req: ApiRequest): string {
  const forwarded = headerValue(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 128) || 'unknown';
  return headerValue(req, 'x-real-ip')?.slice(0, 128) || 'unknown';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function validateBody(value: unknown): ChatBody | null {
  if (!isRecord(value)) return null;

  const model = value.model;
  const rawMessages = value.messages;
  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model) || !Array.isArray(rawMessages)) {
    return null;
  }
  if (rawMessages.length === 0 || rawMessages.length > MAX_MESSAGES) return null;

  const messages: ChatMessage[] = [];
  for (const rawMessage of rawMessages) {
    if (!isRecord(rawMessage)) return null;
    const role = rawMessage.role;
    const content = rawMessage.content;
    if (
      (role !== 'system' && role !== 'user' && role !== 'assistant') ||
      typeof content !== 'string' ||
      content.length === 0 ||
      content.length > MAX_MESSAGE_CHARS
    ) {
      return null;
    }
    messages.push({ role, content });
  }

  const temperature = value.temperature;
  if (temperature !== undefined && (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    return null;
  }
  const maxTokens = value.max_tokens;
  if (maxTokens !== undefined && (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS)) {
    return null;
  }

  return {
    model,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens ?? 500,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const limit = rateLimit(req);
  if (!limit.allowed) {
    res.setHeader?.('Retry-After', limit.retryAfter);
    res.status(429).json({ code: 'rate_limited', error: 'Too many AI requests', retry_after_seconds: limit.retryAfter });
    return;
  }

  const body = validateBody(parseBody(req.body));
  if (!body) {
    res.status(400).json({ error: 'Invalid chat request' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(503).json({ code: 'ai_not_configured', error: 'AI service is not configured' });
    return;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://hanpath.com',
        'X-Title': 'HànPath Learning App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      res.status(response.status === 429 ? 429 : 502).json({ error: 'Upstream AI request failed' });
      return;
    }

    const data: unknown = await response.json();
    if (!isRecord(data)) {
      res.status(502).json({ error: 'Upstream AI returned an invalid response' });
      return;
    }
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: 'Unable to reach the upstream AI service' });
  }
}
