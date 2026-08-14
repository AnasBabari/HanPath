/**
 * OpenRouter AI Utility via Secure Proxy
 * Calls the Vercel / Node Serverless Function at /api/chat with educational context.
 */

import {
  ALLOWED_MODELS,
  DEFAULT_MODEL,
  type EducationalChatContext,
  type ChatMessageItem,
} from '../shared/chatContract';

export interface AICallOptions {
  context?: EducationalChatContext;
  model?: string;
  authToken?: string;
}

export async function callOpenRouter(
  messages: Array<{ role: 'user' | 'assistant' | string; content: string }>,
  options?: AICallOptions | string, // Backward compatible: string treated as system prompt/context
  legacyModel: string = DEFAULT_MODEL
): Promise<string> {
  let context: EducationalChatContext | undefined;
  let model = legacyModel;
  let authToken: string | undefined;

  if (typeof options === 'string') {
    // If legacy caller passed a system prompt string, extract intent or treat as chat
    context = { mode: 'chat' };
  } else if (options && typeof options === 'object') {
    context = options.context;
    model = options.model || model;
    authToken = options.authToken;
  }

  // Filter messages to strictly valid user / assistant turns
  const cleanMessages: ChatMessageItem[] = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'model')
    .map((m) => ({
      role: (m.role === 'model' ? 'assistant' : m.role) as 'user' | 'assistant',
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0);

  if (cleanMessages.length === 0) {
    throw new Error('No valid messages provided to AI.');
  }

  const modelCandidates = (ALLOWED_MODELS as readonly string[]).includes(model)
    ? [model, ...ALLOWED_MODELS.filter((m) => m !== model)]
    : [...ALLOWED_MODELS];

  let lastError = 'Failed to connect to AI';
  const attemptedModels: string[] = [];

  for (const modelId of modelCandidates) {
    attemptedModels.push(modelId);
    let terminalFailure = false;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: cleanMessages,
          context,
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        let errorData: { code?: string; error?: string } = {};
        try {
          errorData = (await response.json()) as { code?: string; error?: string };
        } catch {
          errorData = { error: await response.text() };
        }

        const msg = errorData.error || `HTTP Error ${response.status}`;
        lastError = msg;

        // Terminal errors: 400 (Bad request), 429 (Rate limit), 503 (Unconfigured AI key), 504 (Timeout)
        if ([400, 401, 403, 429, 503, 504].includes(response.status) || errorData.code === 'ai_not_configured') {
          terminalFailure = true;
          throw new Error(msg);
        }
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content || '';
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : lastError;
      if (terminalFailure) {
        throw err;
      }
    }
  }

  throw new Error(`AI service temporarily unavailable (${attemptedModels.join(', ')}). ${lastError}`);
}
