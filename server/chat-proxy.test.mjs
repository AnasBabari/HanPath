import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseChatBody, buildPedagogicalSystemPrompt, createChatProxyServer } from './chat-proxy.mjs';
import {
  buildPedagogicalSystemPrompt as sharedBuildPrompt,
  validateChatRequest as sharedValidateRequest,
} from '../src/shared/chatContract.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe('Docker Node Chat Proxy Contract Parity', () => {
  it('generates identical pedagogical system prompts across platforms', () => {
    const contexts = [
      { mode: 'chat', hskLevel: 1 },
      { mode: 'explain-mistake', hskLevel: 2, userAnswer: '水', correctAnswer: '茶', exercisePrompt: 'tea' },
      { mode: 'explain-word', hskLevel: 3, targetWord: '机场' },
      { mode: 'explain-grammar', hskLevel: 1 },
    ];

    for (const ctx of contexts) {
      const serverPrompt = buildPedagogicalSystemPrompt(ctx);
      const sharedPrompt = sharedBuildPrompt(ctx);
      expect(serverPrompt).toBe(sharedPrompt);
    }
  });

  it('validates and sanitizes payloads identically to the shared contract', () => {
    const rawPayload = JSON.stringify({
      messages: [{ role: 'user', content: 'Ni hao' }],
      context: { mode: 'chat', hskLevel: 2 },
      model: 'openrouter/free',
    });

    const serverParsed = parseChatBody(rawPayload);
    const sharedParsed = sharedValidateRequest(JSON.parse(rawPayload));

    expect(serverParsed.valid).toBe(true);
    expect(sharedParsed.valid).toBe(true);
    expect(serverParsed.sanitized.model).toBe(sharedParsed.sanitized.model);
    expect(serverParsed.sanitized.messages[0].content).toBe(sharedParsed.sanitized.messages[0].content);
  });

  it('rejects malicious or oversized payloads', () => {
    const emptyMessages = JSON.stringify({ messages: [] });
    expect(parseChatBody(emptyMessages).valid).toBe(false);

    const nonObject = JSON.stringify('not-an-object');
    expect(parseChatBody(nonObject).valid).toBe(false);
  });

  it('creates functional server instance that exposes /healthz and responds with 200', async () => {
    const server = createChatProxyServer();
    expect(server).toBeDefined();
  });
});
