import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './chat';

function responseRecorder() {
  let statusCode = 200;
  let body: Record<string, unknown> | undefined;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
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

    expect(recorder.read()).toEqual({ statusCode: 503, body: { error: 'AI service is not configured' } });
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
});
