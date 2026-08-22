import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from './health.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health Endpoint', () => {
  it('returns 200 with dynamic git commit deployment version', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc12345def67890');

    const req = {
      method: 'GET',
      headers: {},
    } as unknown as IncomingMessage;

    let responseData = '';
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn().mockImplementation((chunk: string) => {
        responseData = chunk;
      }),
    } as unknown as ServerResponse;

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, no-cache, must-revalidate');

    const parsed = JSON.parse(responseData);
    expect(parsed.status).toBe('ok');
    expect(parsed.version).toBe('abc12345def67890');
  });

  it('rejects non-GET requests with 405 Method Not Allowed', async () => {
    const req = {
      method: 'POST',
      headers: {},
    } as unknown as IncomingMessage;

    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
  });
});
