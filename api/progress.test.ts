import { describe, it, expect, vi, afterEach } from 'vitest';
import handler from './progress.js';
import * as authLib from './_lib/auth.js';
import * as dbLib from './_lib/supabaseAdmin.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

import { createDefaultProgressSnapshotV4 } from '../src/utils/progressSchema.js';

const sampleSnapshot = createDefaultProgressSnapshotV4();
sampleSnapshot.hskLevelProgress[1].completedLessons = ['hsk1-l1'];
sampleSnapshot.studyDays = ['2026-08-22'];
sampleSnapshot.stats.totalXP = 50;
sampleSnapshot.stats.totalCorrect = 10;
sampleSnapshot.stats.totalAttempted = 10;
sampleSnapshot.wordAccuracy['hsk1-1'] = {
  correct: 10,
  total: 10,
  lastSeen: Date.now(),
};
sampleSnapshot.wordSRS['hsk1-1'] = {
  wordId: 'hsk1-1',
  interval: 1,
  easeFactor: 2.5,
  nextReviewDate: '2026-08-23',
  repetitions: 1,
  updatedAt: '2026-08-22T10:00:00.000Z',
};

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

describe('API /api/progress Integration Suite', () => {
  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'unauthorized',
      userId: null,
      identifier: '',
      guestCookieHeader: null,
      error: 'Unauthorized: Valid Bearer token required',
    });

    const { runPromise, res, getResponseData } = createMockReqRes('GET');
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

    const { runPromise, res, getResponseData } = createMockReqRes('GET');
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

    const { runPromise, res, getResponseData } = createMockReqRes('GET');
    await runPromise;

    expect(res.statusCode).toBe(503);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Database service unavailable');
  });

  it('rejects PUT with non-JSON Content-Type with 415', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });
    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({} as any);

    const { runPromise, res, getResponseData } = createMockReqRes(
      'PUT',
      { snapshot: sampleSnapshot, expectedVersion: 0 },
      { 'content-type': 'text/plain' }
    );
    await runPromise;

    expect(res.statusCode).toBe(415);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Unsupported Media Type');
  });

  it('executes atomic save_user_progress RPC successfully on PUT', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        status: 'success',
        version: 1,
        updated_at: '2026-08-22T12:00:00.000Z',
      },
      error: null,
    });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({
      rpc: rpcMock,
    } as any);

    const { runPromise, res, getResponseData } = createMockReqRes('PUT', {
      snapshot: sampleSnapshot,
      expectedVersion: 0,
    });
    await runPromise;

    expect(res.statusCode).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('save_user_progress', {
      p_user_id: 'test-user-uuid',
      p_snapshot: sampleSnapshot,
      p_expected_version: 0,
    });

    const parsed = JSON.parse(getResponseData());
    expect(parsed.version).toBe(1);
    expect(parsed.updatedAt).toBe('2026-08-22T12:00:00.000Z');
  });

  it('handles 409 conflict when expectedVersion mismatches on PUT', async () => {
    vi.spyOn(authLib, 'resolveIdentity').mockResolvedValue({
      type: 'user',
      userId: 'test-user-uuid',
      identifier: 'user:test-user-uuid',
      guestCookieHeader: null,
    });

    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        status: 'conflict',
        current_version: 3,
        snapshot: sampleSnapshot,
        updated_at: '2026-08-22T11:00:00.000Z',
      },
      error: null,
    });

    vi.spyOn(dbLib, 'getSupabaseAdmin').mockReturnValue({
      rpc: rpcMock,
    } as any);

    const { runPromise, res, getResponseData } = createMockReqRes('PUT', {
      snapshot: sampleSnapshot,
      expectedVersion: 1,
    });
    await runPromise;

    expect(res.statusCode).toBe(409);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error).toContain('Conflict');
    expect(parsed.currentEnvelope.version).toBe(3);
  });
});
