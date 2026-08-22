import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import accountHandler from './account';

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
  req.method = options.method || 'DELETE';
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

describe('API: /api/account Deletion & Idempotency Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-DELETE methods with 405', async () => {
    const { req, res, promise } = createMockReqRes({ method: 'GET' });
    await accountHandler(req, res);
    const result = await promise;
    expect(result.statusCode).toBe(405);
  });

  it('rejects unauthorized delete request with 401', async () => {
    const { req, res, promise } = createMockReqRes({
      method: 'DELETE',
    });
    await accountHandler(req, res);
    const result = await promise;
    expect(result.statusCode).toBe(401);
  });

  it('rejects deletion without explicit confirmation { confirm: true } with 400', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
      },
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const { req, res, promise } = createMockReqRes({
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
      body: JSON.stringify({ confirm: false }),
    });

    await accountHandler(req, res);
    const result = await promise;
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toContain('confirmation required');
  });

  it('fails with 500 if user progress deletion fails', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
        admin: {
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'user_progress') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'DB connection failure' } }),
            }),
          };
        }
      }),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const { req, res, promise } = createMockReqRes({
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
      body: JSON.stringify({ confirm: true }),
    });

    await accountHandler(req, res);
    const result = await promise;
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toContain('Failed to delete user progress');
    expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('successfully executes verified deletion and removes auth user', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-1' } },
          error: null,
        }),
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
      from: vi.fn().mockImplementation(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })),
    };
    vi.mocked(getSupabaseAdmin).mockReturnValue(mockSupabase as any);

    const { req, res, promise } = createMockReqRes({
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
      body: JSON.stringify({ confirm: true }),
    });

    await accountHandler(req, res);
    const result = await promise;
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('usr-1');
  });
});
