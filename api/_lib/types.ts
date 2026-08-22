export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type PedagogicalMode = 'chat' | 'explain-mistake' | 'explain-word' | 'explain-grammar';

export interface PedagogicalContext {
  mode?: PedagogicalMode;
  hskLevel?: 1 | 2;
  targetWord?: string;
  userAnswer?: string;
  correctAnswer?: string;
  exercisePrompt?: string;
}

export interface ChatRequestBody {
  messages: ChatMessage[];
  context?: PedagogicalContext;
}

export interface QuotaInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface ChatResponseBody {
  message: string;
  quota: QuotaInfo;
  requestId: string;
}

export interface ChatErrorResponse {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  requestId: string;
  retryAfter?: number;
}

export interface QuotaResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  retryAfterSeconds?: number;
}
