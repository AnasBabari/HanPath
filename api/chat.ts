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
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: Record<string, unknown>): void;
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

  const body = validateBody(parseBody(req.body));
  if (!body) {
    res.status(400).json({ error: 'Invalid chat request' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'AI service is not configured' });
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
