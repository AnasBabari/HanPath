import { afterEach, describe, expect, it, vi } from 'vitest';
import { callOpenRouter } from './ai';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Client callOpenRouter Utility', () => {
  it('submits a single request and returns the parsed message', async () => {
    let capturedBody: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;

    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      capturedBody = init?.body as string;
      capturedHeaders = init?.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ message: '你好！(nǐ hǎo)', quota: { limit: 5, remaining: 4 } }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenRouter(
      [{ role: 'user', content: 'Explain word' }],
      {
        context: { mode: 'explain-word', hskLevel: 1, targetWord: '你' },
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toBe('你好！(nǐ hǎo)');
    expect(capturedHeaders?.['Content-Type']).toBe('application/json');

    const parsed = JSON.parse(capturedBody!);
    expect(parsed.context.mode).toBe('explain-word');
    expect(parsed.context.targetWord).toBe('你');
  });

  it('parses error response once and throws the error message without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { code: 'quota_exceeded', message: 'Daily AI quota reached.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callOpenRouter([{ role: 'user', content: 'Hello' }])).rejects.toThrow('Daily AI quota reached.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
