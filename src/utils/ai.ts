/**
 * Client AI Interface for HanPath Language Tutor
 * Dispatches structured educational requests to the serverless /api/chat endpoint.
 */

export type PedagogicalMode = 'chat' | 'explain-mistake' | 'explain-word' | 'explain-grammar';

export interface PedagogicalContext {
  mode?: PedagogicalMode;
  hskLevel?: 1 | 2;
  targetWord?: string;
  userAnswer?: string;
  correctAnswer?: string;
  exercisePrompt?: string;
}

export interface AICallOptions {
  context?: PedagogicalContext;
  authToken?: string;
}

export interface AIQuotaInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export async function callOpenRouter(
  messages: Array<{ role: 'user' | 'assistant' | string; content: string }>,
  options?: AICallOptions | string
): Promise<string> {
  let context: PedagogicalContext | undefined;
  let authToken: string | undefined;

  if (typeof options === 'string') {
    context = { mode: 'chat' };
  } else if (options && typeof options === 'object') {
    context = options.context;
    authToken = options.authToken;
  }

  // Sanitize message turns for client submission
  const cleanMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'model')
    .map((m) => ({
      role: (m.role === 'model' ? 'assistant' : m.role) as 'user' | 'assistant',
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-10); // Limit to last 10 messages

  if (cleanMessages.length === 0) {
    throw new Error('No valid messages provided to AI.');
  }

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
      messages: cleanMessages,
      context,
    }),
  });

  const responseText = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { error: { message: responseText || `HTTP ${response.status}` } };
  }

  if (!response.ok) {
    const errObj = (data.error && typeof data.error === 'object' ? data.error : {}) as {
      message?: string;
      code?: string;
    };
    const errorMessage =
      errObj.message || (typeof data.error === 'string' ? data.error : `HTTP Error ${response.status}`);
    throw new Error(errorMessage);
  }

  const content = typeof data.message === 'string' ? data.message : '';
  if (!content) {
    throw new Error('Received empty response from AI tutor.');
  }

  return content;
}
