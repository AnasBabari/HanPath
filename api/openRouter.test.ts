import { afterEach, describe, expect, it, vi } from 'vitest';
import { callOpenRouterWithFallback, RELIABLE_FREE_MODELS } from './_lib/openRouter.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function upstreamResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('OpenRouter fallback client', () => {
  it('fails closed when no server API key is configured', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');

    await expect(callOpenRouterWithFallback([])).resolves.toMatchObject({
      success: false,
      error: { code: 'ai_not_configured', status: 503, retryable: false },
    });
  });

  it('uses server-owned context, bounds history, and returns trimmed content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse(200, {
      choices: [{ message: { content: '  你好！  ' } }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const messages = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 ? 'assistant' as const : 'user' as const,
      content: `${index}-${'x'.repeat(1_100)}`,
    }));
    const result = await callOpenRouterWithFallback(messages, {
      mode: 'explain-word',
      hskLevel: 2,
      targetWord: '学习',
      userAnswer: '学',
    }, 'test-key');

    expect(result).toEqual({
      success: true,
      content: '你好！',
      modelUsed: RELIABLE_FREE_MODELS[0],
    });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(request.body));
    expect(payload.messages).toHaveLength(10);
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[0].content).toContain('HSK 2');
    expect(payload.messages[1].content).toContain('"targetWord":"学习"');
    expect(payload.messages[2].content).toHaveLength(1_000);
    expect(payload.messages.at(-1).role).toBe('assistant');
  });

  it('falls back after empty success responses instead of returning an undefined status', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(upstreamResponse(200, { choices: [] }))
      .mockResolvedValueOnce(upstreamResponse(200, { choices: [{ message: { content: 'fallback' } }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callOpenRouterWithFallback([{ role: 'user', content: 'Hi' }], undefined, 'key'))
      .resolves.toEqual({
        success: true,
        content: 'fallback',
        modelUsed: RELIABLE_FREE_MODELS[1],
      });
  });

  it.each([
    [429, 'rate_limited', 429],
    [503, 'upstream_error', 502],
  ])('exhausts fallback models for retryable HTTP %s responses', async (status, code, mappedStatus) => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse(status));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenRouterWithFallback([{ role: 'user', content: 'Hi' }], undefined, 'key');

    expect(fetchMock).toHaveBeenCalledTimes(RELIABLE_FREE_MODELS.length);
    expect(result).toMatchObject({
      success: false,
      error: { code, status: mappedStatus, retryable: true },
    });
  });

  it('stops immediately for non-retryable provider client errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse(401));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenRouterWithFallback([{ role: 'user', content: 'Hi' }], undefined, 'key');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      success: false,
      error: { code: 'ai_request_failed', status: 401, retryable: false },
    });
  });

  it.each([
    [new Error('offline'), 'network_error', 503],
    [Object.assign(new Error('slow'), { name: 'TimeoutError' }), 'upstream_timeout', 504],
  ])('classifies retryable transport failures', async (failure, code, status) => {
    const fetchMock = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenRouterWithFallback([{ role: 'user', content: 'Hi' }], undefined, 'key');

    expect(fetchMock).toHaveBeenCalledTimes(RELIABLE_FREE_MODELS.length);
    expect(result).toMatchObject({ success: false, error: { code, status, retryable: true } });
  });

  it('does not begin an upstream request when the total deadline is nearly exhausted', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValue(15_800);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenRouterWithFallback([{ role: 'user', content: 'Hi' }], undefined, 'key');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      error: { code: 'upstream_timeout', status: 504, retryable: true },
    });
  });
});
