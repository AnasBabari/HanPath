import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from './account.js';
import * as authLib from './_lib/auth.js';
import * as dbLib from './_lib/supabaseAdmin.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function createMockReqRes(method: string, bodyObj?: unknown, headers: Record<string, string> = {}) {
  const req = new EventEmitter() as unknown as IncomingMessage;
  req.method = method;
  req.headers = { 'content-type': 'application/json', ...headers };

  let responseData = '';
  const headersMap: Record<string, string> = {};

  const res = {
    statusCode: 0,
    setHeader: vi.fn().mockImplementation((key: string, val: string) => {
      headersMap[key.toLowerCase()] = val;
    }),
    end: vi.fn().mockImplementation((chunk: string) => {
      responseData = chunk;
    }),
  } as unknown as ServerResponse;

  const runPromise = handler(req, res);

  setTimeout(() => {
    if (bodyObj !== undefined) {
      req.emit('data', Buffer.from(JSON.stringify(bodyObj)));
    }
    req.emit('end');
  }, 10);

  return { req, res, runPromise, getResponseData: () => responseData, headersMap };
}

describe('DELETE /api/account Integration Suite', () => {
  it('rejects non-DELETE methods with 405 Method Not Allowed', async () => {
    const { runPromise, res } = createMockReqRes('GET');
    await runPromise;
    expect(res.statusCode).toBe(405);
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'unauthorized',
      userId: null,
      identifier: '',
      guestCookieHeader: null,
      error: 'Unauthorized: Valid Bearer token required',
    });

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', { confirm: true });
    await runPromise;

    expect(res.statusCode).toBe(401);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Unauthorized');
  });

  it('returns 503 when authentication infrastructure is unavailable', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'unavailable',
      userId: null,
      identifier: '',
      guestCookieHeader: null,
      error: 'Authentication service is temporarily unavailable',
    });

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', { confirm: true });
    await runPromise;

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(getResponseData()).error).toContain('temporarily unavailable');
  });

  it('returns 503 when Supabase administrator client is unavailable', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue(null);

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', { confirm: true });
    await runPromise;

    expect(res.statusCode).toBe(503);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Database service unavailable');
  });

  it('rejects empty body with 400 Bad Request', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', null);
    await runPromise;

    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Explicit confirmation required');
  });

  it('rejects { confirm: false } with 400 Bad Request', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', { confirm: false });
    await runPromise;

    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Explicit confirmation required');
  });

  it('rejects empty JSON object {} with 400 Bad Request', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', {});
    await runPromise;

    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Explicit confirmation required');
  });

  it('rejects non-JSON Content-Type with 415 Unsupported Media Type', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res, getResponseData } = createMockReqRes(
      'DELETE',
      { confirm: true },
      { 'content-type': 'text/plain' }
    );
    await runPromise;

    expect(res.statusCode).toBe(415);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Unsupported Media Type');
  });

  it('hard-deletes the Auth user so database cascade constraints purge application rows', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });

    const deleteUserMock = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
    } as any);

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', { confirm: true });
    await runPromise;

    expect(res.statusCode).toBe(200);
    expect(deleteUserMock).toHaveBeenCalledWith('test-user-uuid', false);

    const parsed = JSON.parse(getResponseData());
    expect(parsed.success).toBe(true);
  });

  it('returns sanitized error with opaque requestId if auth admin deleteUser fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });

    const deleteUserMock = vi.fn().mockResolvedValue({ error: { message: 'Internal auth service failed' } });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({
      auth: {
        admin: {
          deleteUser: deleteUserMock,
        },
      },
    } as any);

    const { runPromise, res, getResponseData } = createMockReqRes('DELETE', { confirm: true });
    await runPromise;

    expect(res.statusCode).toBe(500);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toBe('Account deletion encountered an issue');
    expect(parsed.requestId).toBeDefined();
    expect(parsed.requestId.length).toBeGreaterThan(10);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[AccountDeletion] Auth Admin deletion failed'),
      { message: 'Internal auth service failed' }
    );
  });
});
