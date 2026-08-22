import type { ChatMessage, PedagogicalContext } from './types.js';
import { buildPedagogicalSystemPrompt } from './prompt.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

  // Prepend server-owned pedagogical system prompt based only on mode and HSK level
  const mode = context?.mode || 'chat';
  const hskLevel = context?.hskLevel === 2 ? 2 : 1;
  const systemPrompt = buildPedagogicalSystemPrompt(mode, hskLevel);

  const upstreamMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Supply untrusted exercise context in a dedicated structured JSON user message
  if (
    context &&
    (context.targetWord || context.exercisePrompt || context.userAnswer || context.correctAnswer)
  ) {
    const safeContext = {
      targetWord: context.targetWord,
      exercisePrompt: context.exercisePrompt,
      userAnswer: context.userAnswer,
      correctAnswer: context.correctAnswer,
    };
    upstreamMessages.push({
      role: 'user',
      content: `[EXERCISE_CONTEXT_DATA]: ${JSON.stringify(safeContext)}`,
    });
  }

  // Append user messages (max last 8)
  for (const m of messages.slice(-8)) {
    upstreamMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.slice(0, 1000),
    });
  }

  let lastError: OpenRouterResult['error'] = {
    code: 'upstream_error',
    message: 'AI assistant is currently unavailable.',
    status: 502,
    retryable: true,
  };

  const TOTAL_DEADLINE_MS = 15000;
  const deadline = Date.now() + TOTAL_DEADLINE_MS;

  for (const model of RELIABLE_FREE_MODELS) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 500) {
      // Exceeded or near total deadline: break immediately
      lastError = {
        code: 'upstream_timeout',
        message: 'AI request timed out within the 15-second deadline.',
        status: 504,
        retryable: true,
      };
      break;
    }

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
        signal: AbortSignal.timeout(remainingMs),
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

        lastError = {
          code: 'invalid_upstream_response',
          message: 'AI provider returned an empty response.',
          status: 502,
          retryable: true,
        };
        continue;
      }

      if (response.status === 429) {
        lastError = {
          code: 'rate_limited',
          message: 'AI service is experiencing high traffic. Please try again shortly.',
          status: 429,
          retryable: true,
          retryAfterSeconds: 5,
        };
        // Continue to fallback model if deadline allows
        continue;
      }

      if (response.status >= 500) {
        lastError = {
          code: 'upstream_error',
          message: 'Upstream AI provider error.',
          status: 502,
          retryable: true,
        };
        // Continue to fallback model if deadline allows
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
      const isTimeout =
        (err instanceof Error && err.name === 'TimeoutError') ||
        Date.now() >= deadline;

      lastError = {
        code: isTimeout ? 'upstream_timeout' : 'network_error',
        message: isTimeout
          ? 'AI request timed out within the 15-second deadline.'
          : 'Failed to contact AI service.',
        status: isTimeout ? 504 : 503,
        retryable: true,
      };

      if (Date.now() >= deadline) {
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
