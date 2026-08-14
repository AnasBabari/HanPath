import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { resetChatRateLimits } from './chat';
import { buildPedagogicalSystemPrompt, validateChatRequest } from '../src/shared/chatContract';

function responseRecorder() {
  let statusCode = 200;
  let body: Record<string, unknown> | undefined;
  const res = {
    headers: new Map<string, string | number>(),
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string | number) {
      res.headers.set(name, value);
    },
    json(value: Record<string, unknown>) {
      body = value;
    },
  };
  return { res, read: () => ({ statusCode, body }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  resetChatRateLimits();
});

describe('/api/chat validation boundary & pedagogical constraints', () => {
  it('rejects arbitrary model IDs and falls back or validates', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const recorder = responseRecorder();

    // Invalid messages format
    await handler(
      {
        method: 'POST',
        body: { messages: [] },
      },
      recorder.res,
    );

    expect(recorder.read().statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the server-side key is absent', async () => {
    const recorder = responseRecorder();

    await handler(
      {
        method: 'POST',
        body: { messages: [{ role: 'user', content: 'hello' }] },
      },
      recorder.res,
    );

    expect(recorder.read()).toEqual({
      statusCode: 503,
      body: {
        code: 'ai_not_configured',
        error: 'AI assistant service is currently unconfigured. Lessons and flashcard review remain fully functional.',
      },
    });
  });

  it('generates server-owned educational system prompt for explain-mistake mode', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    let interceptedBody: string | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url, init) => {
        interceptedBody = init?.body as string;
        return Promise.resolve({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Good effort!' } }] }),
        });
      }),
    );

    const recorder = responseRecorder();
    await handler(
      {
        method: 'POST',
        body: {
          messages: [{ role: 'user', content: 'Why is this wrong?' }],
          context: {
            mode: 'explain-mistake',
            hskLevel: 1,
            userAnswer: '水',
            correctAnswer: '茶',
            exercisePrompt: 'Translate: tea',
          },
        },
      },
      recorder.res,
    );

    expect(recorder.read().statusCode).toBe(200);
    expect(interceptedBody).toBeDefined();
    const parsed = JSON.parse(interceptedBody!);
    expect(parsed.messages[0].role).toBe('system');
    expect(parsed.messages[0].content).toContain('Task: Explain a mistake');
    expect(parsed.messages[0].content).toContain('Learner\'s answer: "水"');
    expect(parsed.messages[0].content).toContain('Correct solution: "茶"');
  });

  it('does not expose raw upstream exception stack traces to the client', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'secret upstream stack trace',
      }),
    );
    const recorder = responseRecorder();

    await handler(
      {
        method: 'POST',
        body: { messages: [{ role: 'user', content: 'hello' }] },
      },
      recorder.res,
    );

    expect(recorder.read()).toEqual({
      statusCode: 502,
      body: {
        code: 'upstream_error',
        error: 'Upstream AI service encountered an error.',
      },
    });
  });

  it('limits repeated requests by forwarded client address', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    const request = {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.42' },
      body: { messages: [{ role: 'user', content: 'hello' }] },
    };

    for (let i = 0; i < 10; i += 1) {
      await handler(request, responseRecorder().res);
    }
    const recorder = responseRecorder();
    await handler(request, recorder.res);

    expect(recorder.read().statusCode).toBe(429);
    expect(recorder.read().body).toMatchObject({ code: 'rate_limited' });
  });

  it('validates chat request helper directly', () => {
    const invalid = validateChatRequest({});
    expect(invalid.valid).toBe(false);

    const valid = validateChatRequest({
      messages: [{ role: 'user', content: '你好' }],
      context: { mode: 'chat', hskLevel: 2 },
    });
    expect(valid.valid).toBe(true);
    expect(valid.sanitized?.context?.hskLevel).toBe(2);
  });

  it('constructs specific prompt for vocabulary explanation', () => {
    const prompt = buildPedagogicalSystemPrompt({
      mode: 'explain-word',
      hskLevel: 2,
      targetWord: '苹果',
    });
    expect(prompt).toContain('苹果');
    expect(prompt).toContain('HSK 2');
  });
});
