import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import progressHandler from './progress';
import { createDefaultProgressSnapshotV4 } from '../src/utils/progressSchema';

vi.mock('./_lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { getSupabaseAdmin } from './_lib/supabaseAdmin';

function createMockReqRes(options: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) {
  const req = new EventEmitter() as any;
  req.method = options.method || 'GET';
  req.headers = options.headers || {};

  process.nextTick(() => {
    if (options.body) {
      req.emit('data', Buffer.from(options.body));
    }
    req.emit('end');
  });

  let resolvePromise: (val: { statusCode: number; headers: Record<string, string>; body: string }) => void;
  const promise = new Promise<{ statusCode: number; headers: Record<string, string>; body: string }>(
    (res) => (resolvePromise = res)
  );

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    },
    end(data?: string) {
      resolvePromise({
        statusCode: this.statusCode,
        headers: this.headers,
        body: data || '',
      });
    },
  } as any;

  return { req, res, promise };
}

describe('API: /api/progress Handler & Concurrency Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized request without valid Bearer token (401)', async () => {
    const { req, res, promise } = createMockReqRes({
      method: 'GET',
    });

    await progressHandler(req, res);
    const result = await promise;

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toContain('Unauthorized');
  });

  it('rejects invalid or expired token with 401', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Token expired' },
        }),
      },
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const { req, res, promise } = createMockReqRes({
      method: 'GET',
      headers: { authorization: 'Bearer expired-token' },
    });

    await progressHandler(req, res);
    const result = await promise;

    expect(result.statusCode).toBe(401);
  });

  it('returns 404 on GET when no progress record exists', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const { req, res, promise } = createMockReqRes({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    });

    await progressHandler(req, res);
    const result = await promise;

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toContain('No cloud progress found');
  });

  it('rejects invalid snapshot schema on PUT with 422 Unprocessable Entity', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
      },
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const invalidBody = JSON.stringify({
      snapshot: { schemaVersion: 99, invalidField: true },
      expectedVersion: 0,
    });

    const { req, res, promise } = createMockReqRes({
      method: 'PUT',
      headers: { authorization: 'Bearer valid-token' },
      body: invalidBody,
    });

    await progressHandler(req, res);
    const result = await promise;

    expect(result.statusCode).toBe(422);
    expect(JSON.parse(result.body).error).toContain('validation failed');
  });

  it('returns 409 Conflict when expectedVersion does not match current DB version', async () => {
    const defaultSnap = createDefaultProgressSnapshotV4();
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { snapshot: defaultSnap, version: 3, updated_at: '2026-08-20T10:00:00Z' },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const body = JSON.stringify({
      snapshot: defaultSnap,
      expectedVersion: 2, // Out of date, DB is at version 3
    });

    const { req, res, promise } = createMockReqRes({
      method: 'PUT',
      headers: { authorization: 'Bearer valid-token' },
      body,
    });

    await progressHandler(req, res);
    const result = await promise;

    expect(result.statusCode).toBe(409);
    const json = JSON.parse(result.body);
    expect(json.error).toContain('Conflict');
    expect(json.currentEnvelope.version).toBe(3);
  });

  it('atomically updates progress when expectedVersion matches and increments version', async () => {
    const defaultSnap = createDefaultProgressSnapshotV4();
    const nextSnap = {
      ...defaultSnap,
      stats: { ...defaultSnap.stats, totalXP: 50 },
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'user_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { snapshot: defaultSnap, version: 2, updated_at: '2026-08-20T10:00:00Z' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockResolvedValue({
                    data: [{ snapshot: nextSnap, version: 3, updated_at: '2026-08-22T12:00:00Z' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
      }),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const body = JSON.stringify({
      snapshot: nextSnap,
      expectedVersion: 2,
    });

    const { req, res, promise } = createMockReqRes({
      method: 'PUT',
      headers: { authorization: 'Bearer valid-token' },
      body,
    });

    await progressHandler(req, res);
    const result = await promise;

    expect(result.statusCode).toBe(200);
    const json = JSON.parse(result.body);
    expect(json.version).toBe(3);
    expect(json.snapshot.stats.totalXP).toBe(50);
  });
});
