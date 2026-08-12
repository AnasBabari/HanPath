import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { resetChatRateLimits } from './chat';

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

describe('/api/chat validation boundary', () => {
  it('rejects arbitrary model IDs before contacting OpenRouter', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const recorder = responseRecorder();

    await handler(
      {
        method: 'POST',
        body: { model: 'paid/provider', messages: [{ role: 'user', content: 'hello' }] },
      },
      recorder.res,
    );

    expect(recorder.read()).toEqual({ statusCode: 400, body: { error: 'Invalid chat request' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the server-side key is absent', async () => {
    const recorder = responseRecorder();

    await handler(
      {
        method: 'POST',
        body: { model: 'openrouter/free', messages: [{ role: 'user', content: 'hello' }] },
      },
      recorder.res,
    );

    expect(recorder.read()).toEqual({
      statusCode: 503,
      body: { code: 'ai_not_configured', error: 'AI service is not configured' },
    });
  });

  it('does not expose upstream response text to the browser', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'secret upstream detail' }));
    const recorder = responseRecorder();

    await handler(
      {
        method: 'POST',
        body: { model: 'openrouter/free', messages: [{ role: 'user', content: 'hello' }] },
      },
      recorder.res,
    );

    expect(recorder.read()).toEqual({ statusCode: 502, body: { error: 'Upstream AI request failed' } });
  });

  it('limits repeated requests by forwarded client address', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    const request = {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.42' },
      body: { model: 'openrouter/free', messages: [{ role: 'user', content: 'hello' }] },
    };

    for (let i = 0; i < 10; i += 1) {
      await handler(request, responseRecorder().res);
    }
    const recorder = responseRecorder();
    await handler(request, recorder.res);

    expect(recorder.read().statusCode).toBe(429);
    expect(recorder.read().body).toMatchObject({ code: 'rate_limited' });
  });
});
