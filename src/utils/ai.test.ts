import { afterEach, describe, expect, it, vi } from 'vitest';
import { callOpenRouter } from './ai';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callOpenRouter terminal proxy failures', () => {
  it('does not retry fallback models when the proxy is unconfigured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ code: 'ai_not_configured' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callOpenRouter([{ role: 'user', content: 'hello' }])).rejects.toThrow(
      'HTTP Error 503',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
