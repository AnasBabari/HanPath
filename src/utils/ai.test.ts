import { afterEach, describe, expect, it, vi } from 'vitest';
import { callOpenRouter } from './ai';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callOpenRouter client utility & terminal proxy failures', () => {
  it('does not retry fallback models when the proxy reports unconfigured AI service (503)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ code: 'ai_not_configured', error: 'AI service is not configured' }),
      text: async () => JSON.stringify({ code: 'ai_not_configured', error: 'AI service is not configured' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callOpenRouter([{ role: 'user', content: 'hello' }])).rejects.toThrow(
      'AI service is not configured',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes educational context and auth token when provided', async () => {
    let capturedBody: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;

    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      capturedBody = init?.body as string;
      capturedHeaders = init?.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '你好！' } }] }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenRouter(
      [{ role: 'user', content: 'Explain this word' }],
      {
        context: {
          mode: 'explain-word',
          hskLevel: 2,
          targetWord: '朋友',
        },
        authToken: 'sample-jwt-token-123456789012345',
      },
    );

    expect(result).toBe('你好！');
    expect(capturedHeaders?.['Authorization']).toBe('Bearer sample-jwt-token-123456789012345');
    const parsed = JSON.parse(capturedBody!);
    expect(parsed.context.mode).toBe('explain-word');
    expect(parsed.context.targetWord).toBe('朋友');
  });
});
