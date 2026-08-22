import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  ChatRequestBody,
  ChatResponseBody,
  ChatErrorResponse,
  PedagogicalContext,
  ChatMessage,
} from './_lib/types.js';
import { resolveIdentity } from './_lib/auth.js';
import { checkAndRecordQuota } from './_lib/quota.js';
import { callOpenRouterWithFallback } from './_lib/openRouter.js';

const MAX_MESSAGES = 10;
const MAX_MSG_CHARS = 1000;
const MAX_TOTAL_CHARS = 6000;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32 * 1024) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function validateChatPayload(raw: unknown): {
  valid: boolean;
  messages?: ChatMessage[];
  context?: PedagogicalContext;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const body = raw as Partial<ChatRequestBody>;

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { valid: false, error: 'Field "messages" must be a non-empty array' };
  }

  if (body.messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Maximum ${MAX_MESSAGES} messages permitted per request` };
  }

  let totalChars = 0;
  const sanitizedMessages: ChatMessage[] = [];

  for (const m of body.messages) {
    if (!m || typeof m !== 'object') {
      return { valid: false, error: 'Invalid message structure' };
    }

    const role = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    if (!role) {
      return { valid: false, error: 'Message role must be "user" or "assistant"' };
    }

    if (typeof m.content !== 'string' || m.content.trim().length === 0) {
      return { valid: false, error: 'Message content cannot be empty' };
    }

    if (m.content.length > MAX_MSG_CHARS) {
      return { valid: false, error: `Message content exceeds max limit of ${MAX_MSG_CHARS} characters` };
    }

    totalChars += m.content.length;
    sanitizedMessages.push({ role, content: m.content.trim() });
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return { valid: false, error: `Total conversation characters exceed ${MAX_TOTAL_CHARS}` };
  }

  let sanitizedContext: PedagogicalContext | undefined = undefined;
  if (body.context && typeof body.context === 'object') {
    const rawCtx = body.context;
    const allowedModes = ['chat', 'explain-mistake', 'explain-word', 'explain-grammar'];
    const mode = allowedModes.includes(rawCtx.mode as string)
      ? (rawCtx.mode as PedagogicalContext['mode'])
      : 'chat';
    const hskLevel = rawCtx.hskLevel === 2 ? 2 : 1;

    sanitizedContext = {
      mode,
      hskLevel,
      targetWord: typeof rawCtx.targetWord === 'string' ? rawCtx.targetWord.slice(0, 100) : undefined,
      userAnswer: typeof rawCtx.userAnswer === 'string' ? rawCtx.userAnswer.slice(0, 200) : undefined,
      correctAnswer: typeof rawCtx.correctAnswer === 'string' ? rawCtx.correctAnswer.slice(0, 200) : undefined,
      exercisePrompt: typeof rawCtx.exercisePrompt === 'string' ? rawCtx.exercisePrompt.slice(0, 300) : undefined,
    };
  }

  return { valid: true, messages: sanitizedMessages, context: sanitizedContext };
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    const err: ChatErrorResponse = {
      error: { code: 'method_not_allowed', message: 'Method Not Allowed', retryable: false },
      requestId,
    };
    res.end(JSON.stringify(err));
    return;
  }

  try {
    const rawText = await readBody(req);
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      res.statusCode = 400;
      const err: ChatErrorResponse = {
        error: { code: 'invalid_json', message: 'Malformed JSON payload', retryable: false },
        requestId,
      };
      res.end(JSON.stringify(err));
      return;
    }

    const validation = validateChatPayload(rawJson);
    if (!validation.valid || !validation.messages) {
      res.statusCode = 400;
      const err: ChatErrorResponse = {
        error: { code: 'validation_error', message: validation.error || 'Invalid payload', retryable: false },
        requestId,
      };
      res.end(JSON.stringify(err));
      return;
    }

    // Resolve Identity
    const authHeader = req.headers['authorization'];
    const cookieHeader = req.headers['cookie'];
    const identity = await resolveIdentity(
      typeof authHeader === 'string' ? authHeader : null,
      typeof cookieHeader === 'string' ? cookieHeader : null
    );

    if (identity.guestCookieHeader) {
      res.setHeader('Set-Cookie', identity.guestCookieHeader);
    }

    // Check & Record Quota
    const isGuest = identity.type === 'guest';
    const quota = await checkAndRecordQuota(identity.identifier, isGuest);

    if (!quota.allowed) {
      res.statusCode = 429;
      if (quota.retryAfterSeconds) {
        res.setHeader('Retry-After', String(quota.retryAfterSeconds));
      }
      const err: ChatErrorResponse = {
        error: {
          code: 'quota_exceeded',
          message: isGuest
            ? 'Daily guest AI quota reached (5 requests/day). Sign in for 50 requests/day!'
            : 'Daily AI quota reached (50 requests/day). Resets at midnight UTC.',
          retryable: false,
        },
        requestId,
        retryAfter: quota.retryAfterSeconds,
      };
      res.end(JSON.stringify(err));
      return;
    }

    // Execute OpenRouter call with server-side prompt construction & fallback
    const result = await callOpenRouterWithFallback(validation.messages, validation.context);

    if (!result.success || !result.content) {
      res.statusCode = result.error?.status || 502;
      const err: ChatErrorResponse = {
        error: {
          code: result.error?.code || 'upstream_error',
          message: result.error?.message || 'AI service error.',
          retryable: result.error?.retryable ?? true,
        },
        requestId,
        retryAfter: result.error?.retryAfterSeconds,
      };
      res.end(JSON.stringify(err));
      return;
    }

    res.statusCode = 200;
    const responseBody: ChatResponseBody = {
      message: result.content,
      quota: {
        limit: quota.limit,
        remaining: quota.remaining,
        resetAt: quota.resetAt,
      },
      requestId,
    };
    res.end(JSON.stringify(responseBody));
  } catch {
    res.statusCode = 500;
    const errObj: ChatErrorResponse = {
      error: {
        code: 'internal_server_error',
        message: 'An unexpected internal error occurred.',
        retryable: true,
      },
      requestId,
    };
    res.end(JSON.stringify(errObj));
  }
}
