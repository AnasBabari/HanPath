import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from '../../api/progress.js';
import * as authLib from '../../api/_lib/auth.js';
import * as dbLib from '../../api/_lib/supabaseAdmin.js';
import { createDefaultProgressSnapshotV4 } from '../../src/utils/progressSchema.js';
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

describe('API /api/progress Deep Branches', () => {
  it('handles GET 200 with valid snapshot from database', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });

    const validSnapshot = createDefaultProgressSnapshotV4();
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            user_id: 'test-user-uuid',
            version: 3,
            snapshot: validSnapshot,
            updated_at: '2026-08-22T10:00:00.000Z',
          },
          error: null,
        }),
      }),
    });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
      }),
    } as any);

    const { runPromise, res, getResponseData } = createMockReqRes('GET');
    await runPromise;

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.version).toBe(3);
  });

  it('handles GET 404 when no row exists in database', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'fresh-user-uuid',
      identifier: 'user:fresh-user-uuid',
      guestCookieHeader: null,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: selectMock,
      }),
    } as any);

    const { runPromise, res } = createMockReqRes('GET');
    await runPromise;

    expect(res.statusCode).toBe(404);
  });

  it('handles PUT 422 on invalid snapshot structure', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res } = createMockReqRes('PUT', {
      snapshot: { schemaVersion: 2 }, // invalid version
      expectedVersion: 0,
    });
    await runPromise;

    expect(res.statusCode).toBe(422);
  });

  it('rejects POST with 405 Method Not Allowed', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res } = createMockReqRes('POST');
    await runPromise;

    expect(res.statusCode).toBe(405);
  });
});
