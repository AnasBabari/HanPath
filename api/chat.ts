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
import { checkAndRecordQuota, QuotaStoreUnavailableError } from './_lib/quota.js';
import { callOpenRouterWithFallback } from './_lib/openRouter.js';

const MAX_MESSAGES = 10;
const MAX_MSG_CHARS = 1000;
const MAX_TOTAL_CHARS = 6000;
const MAX_BODY_BYTES = 32 * 1024;

export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload Too Large') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', (chunk: Buffer | string) => {
      bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new PayloadTooLargeError(`Request body exceeds maximum limit of ${MAX_BODY_BYTES} bytes`));
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return true; // Server-side tests, local runners, curl

  if (process.env.APP_ORIGIN && origin === process.env.APP_ORIGIN) {
    return true;
  }

  // Allow localhost & 127.0.0.1 on any port
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // Allow production domain and any Vercel preview deployment
  if (/^https:\/\/([a-zA-Z0-9-]+\.)?vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
}

export function validateChatPayload(raw: unknown): {
  valid: boolean;
  messages?: ChatMessage[];
  context?: PedagogicalContext;
  error?: string;
  isPayloadTooLarge?: boolean;
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
      return {
        valid: false,
        error: `Message content exceeds max limit of ${MAX_MSG_CHARS} characters`,
        isPayloadTooLarge: true,
      };
    }

    totalChars += m.content.length;
    sanitizedMessages.push({ role, content: m.content.trim() });
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return {
      valid: false,
      error: `Total conversation characters exceed ${MAX_TOTAL_CHARS}`,
      isPayloadTooLarge: true,
    };
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

function logStructured(entry: {
  requestId: string;
  endpoint: string;
  identityType: string;
  status: number;
  latencyMs: number;
  modelId?: string;
  errorCode?: string;
}): void {
  console.log(JSON.stringify(entry));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const startTime = Date.now();
  const requestId = `req_${crypto.randomUUID().slice(0, 12)}`;
  let identityType = 'unknown';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  // Origin check
  const originHeader = req.headers['origin'] as string | undefined;
  if (!isAllowedOrigin(originHeader)) {
    res.statusCode = 403;
    const err: ChatErrorResponse = {
      error: { code: 'forbidden_origin', message: 'Forbidden: Invalid request origin', retryable: false },
      requestId,
    };
    logStructured({
      requestId,
      endpoint: '/api/chat',
      identityType,
      status: 403,
      latencyMs: Date.now() - startTime,
      errorCode: 'forbidden_origin',
    });
    res.end(JSON.stringify(err));
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    const err: ChatErrorResponse = {
      error: { code: 'method_not_allowed', message: 'Method Not Allowed', retryable: false },
      requestId,
    };
    logStructured({
      requestId,
      endpoint: '/api/chat',
      identityType,
      status: 405,
      latencyMs: Date.now() - startTime,
      errorCode: 'method_not_allowed',
    });
    res.end(JSON.stringify(err));
    return;
  }

  // Content-Type validation
  const contentType = req.headers['content-type'];
  if (contentType && !contentType.toLowerCase().includes('application/json')) {
    res.statusCode = 415;
    const err: ChatErrorResponse = {
      error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json', retryable: false },
      requestId,
    };
    logStructured({
      requestId,
      endpoint: '/api/chat',
      identityType,
      status: 415,
      latencyMs: Date.now() - startTime,
      errorCode: 'unsupported_media_type',
    });
    res.end(JSON.stringify(err));
    return;
  }

  try {
    let rawText: string;
    try {
      rawText = await readBody(req);
    } catch (readErr: unknown) {
      if (readErr instanceof PayloadTooLargeError) {
        res.statusCode = 413;
        const err: ChatErrorResponse = {
          error: { code: 'payload_too_large', message: readErr.message, retryable: false },
          requestId,
        };
        logStructured({
          requestId,
          endpoint: '/api/chat',
          identityType,
          status: 413,
          latencyMs: Date.now() - startTime,
          errorCode: 'payload_too_large',
        });
        res.end(JSON.stringify(err));
        return;
      }
      throw readErr;
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText);
    } catch {
      res.statusCode = 400;
      const err: ChatErrorResponse = {
        error: { code: 'invalid_json', message: 'Malformed JSON payload', retryable: false },
        requestId,
      };
      logStructured({
        requestId,
        endpoint: '/api/chat',
        identityType,
        status: 400,
        latencyMs: Date.now() - startTime,
        errorCode: 'invalid_json',
      });
      res.end(JSON.stringify(err));
      return;
    }

    const validation = validateChatPayload(rawJson);
    if (!validation.valid || !validation.messages) {
      const status = validation.isPayloadTooLarge ? 413 : 422;
      res.statusCode = status;
      const code = validation.isPayloadTooLarge ? 'payload_too_large' : 'validation_error';
      const err: ChatErrorResponse = {
        error: { code, message: validation.error || 'Invalid payload', retryable: false },
        requestId,
      };
      logStructured({
        requestId,
        endpoint: '/api/chat',
        identityType,
        status,
        latencyMs: Date.now() - startTime,
        errorCode: code,
      });
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

    identityType = identity.type;

    if (identity.type === 'unauthorized') {
      res.statusCode = 401;
      const err: ChatErrorResponse = {
        error: {
          code: 'unauthorized',
          message: identity.error || 'Unauthorized: Invalid credentials provided',
          retryable: false,
        },
        requestId,
      };
      logStructured({
        requestId,
        endpoint: '/api/chat',
        identityType,
        status: 401,
        latencyMs: Date.now() - startTime,
        errorCode: 'unauthorized',
      });
      res.end(JSON.stringify(err));
      return;
    }

    if (identity.guestCookieHeader) {
      res.setHeader('Set-Cookie', identity.guestCookieHeader);
    }

    // Check & Record Quota
    const isGuest = identity.type === 'guest';
    let quota;
    try {
      quota = await checkAndRecordQuota(identity.identifier, isGuest);
    } catch (quotaErr: unknown) {
      if (quotaErr instanceof QuotaStoreUnavailableError) {
        res.statusCode = 503;
        const err: ChatErrorResponse = {
          error: {
            code: 'service_unavailable',
            message: 'AI quota service is temporarily unavailable. Please try again shortly.',
            retryable: true,
          },
          requestId,
        };
        logStructured({
          requestId,
          endpoint: '/api/chat',
          identityType,
          status: 503,
          latencyMs: Date.now() - startTime,
          errorCode: 'service_unavailable',
        });
        res.end(JSON.stringify(err));
        return;
      }
      throw quotaErr;
    }

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
      logStructured({
        requestId,
        endpoint: '/api/chat',
        identityType,
        status: 429,
        latencyMs: Date.now() - startTime,
        errorCode: 'quota_exceeded',
      });
      res.end(JSON.stringify(err));
      return;
    }

    // Execute OpenRouter call with server-side prompt construction & fallback
    const result = await callOpenRouterWithFallback(validation.messages, validation.context);

    if (!result.success || !result.content) {
      const status = result.error?.status || 502;
      res.statusCode = status;
      const err: ChatErrorResponse = {
        error: {
          code: result.error?.code || 'upstream_error',
          message: result.error?.message || 'AI service error.',
          retryable: result.error?.retryable ?? true,
        },
        requestId,
        retryAfter: result.error?.retryAfterSeconds,
      };
      logStructured({
        requestId,
        endpoint: '/api/chat',
        identityType,
        status,
        latencyMs: Date.now() - startTime,
        modelId: result.modelUsed,
        errorCode: result.error?.code || 'upstream_error',
      });
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
    logStructured({
      requestId,
      endpoint: '/api/chat',
      identityType,
      status: 200,
      latencyMs: Date.now() - startTime,
      modelId: result.modelUsed,
    });
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
    logStructured({
      requestId,
      endpoint: '/api/chat',
      identityType,
      status: 500,
      latencyMs: Date.now() - startTime,
      errorCode: 'internal_server_error',
    });
    res.end(JSON.stringify(errObj));
  }
}
