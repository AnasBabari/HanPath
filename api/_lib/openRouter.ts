import type { ChatMessage, PedagogicalContext } from './types.js';
import { buildPedagogicalSystemPrompt } from './prompt.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 15000;

export const RELIABLE_FREE_MODELS = [
  'arcee-ai/trinity-large-preview:free',
  'qwen/qwen3-4b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.2-3b-instruct:free',
] as const;

export interface OpenRouterResult {
  success: boolean;
  content?: string;
  modelUsed?: string;
  error?: {
    code: string;
    message: string;
    status: number;
    retryable: boolean;
    retryAfterSeconds?: number;
  };
}

export async function callOpenRouterWithFallback(
  messages: ChatMessage[],
  context?: PedagogicalContext,
  apiKeyOverride?: string
): Promise<OpenRouterResult> {
  const apiKey = apiKeyOverride || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: {
        code: 'ai_not_configured',
        message: 'AI service is currently not configured on this environment.',
        status: 503,
        retryable: false,
      },
    };
  }

  // Prepend server-owned pedagogical system prompt
  const systemPrompt = buildPedagogicalSystemPrompt(context);
  const upstreamMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.slice(0, 1000),
    })),
  ];

  let lastError: OpenRouterResult['error'] = {
    code: 'upstream_error',
    message: 'AI assistant is currently unavailable.',
    status: 502,
    retryable: true,
  };

  for (const model of RELIABLE_FREE_MODELS) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://han-path.vercel.app',
          'X-Title': 'HanPath Language Tutor',
        },
        body: JSON.stringify({
          model,
          messages: upstreamMessages,
          temperature: 0.7,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (content) {
          return {
            success: true,
            content,
            modelUsed: model,
          };
        }
      }

      if (response.status === 429) {
        lastError = {
          code: 'rate_limited',
          message: 'AI service is experiencing high traffic. Please try again shortly.',
          status: 429,
          retryable: true,
          retryAfterSeconds: 5,
        };
        // Continue to fallback model
        continue;
      }

      if (response.status >= 500) {
        lastError = {
          code: 'upstream_error',
          message: 'Upstream AI provider error.',
          status: 502,
          retryable: true,
        };
        // Continue to fallback model
        continue;
      }

      // For other client errors (400, 401, 403), stop retrying
      return {
        success: false,
        error: {
          code: 'ai_request_failed',
          message: `AI provider returned status ${response.status}`,
          status: response.status,
          retryable: false,
        },
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      lastError = {
        code: isTimeout ? 'upstream_timeout' : 'network_error',
        message: isTimeout
          ? 'AI request timed out after 15 seconds.'
          : 'Failed to contact AI service.',
        status: isTimeout ? 504 : 503,
        retryable: true,
      };
      // Try next fallback model
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
