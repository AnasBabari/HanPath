import { describe, it, expect, vi, afterEach } from 'vitest';
import handler, { validateChatPayload } from './chat.js';
import { signGuestId } from './_lib/guest.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function createMockReqRes(method: string, bodyObj?: unknown, headers: Record<string, string> = {}) {
  const req = new EventEmitter() as unknown as IncomingMessage;
  req.method = method;
  req.headers = { ...headers };

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

  if (bodyObj !== undefined) {
    req.emit('data', Buffer.from(JSON.stringify(bodyObj)));
  }
  req.emit('end');

  return { req, res, runPromise, getResponseData: () => responseData, headersMap };
}

describe('POST /api/chat Serverless Handler', () => {
  it('validates chat payloads accurately', () => {
    expect(validateChatPayload(null).valid).toBe(false);
    expect(validateChatPayload({}).valid).toBe(false);
    expect(validateChatPayload({ messages: [] }).valid).toBe(false);

    const validPayload = {
      messages: [{ role: 'user', content: 'Hello' }],
      context: { mode: 'explain-word', hskLevel: 1, targetWord: '你' },
    };
    const result = validateChatPayload(validPayload);
    expect(result.valid).toBe(true);
    expect(result.messages?.[0].content).toBe('Hello');
    expect(result.context?.targetWord).toBe('你');
  });

  it('rejects GET requests with 405 Method Not Allowed', async () => {
    const { runPromise, res } = createMockReqRes('GET');
    await runPromise;
    expect(res.statusCode).toBe(405);
  });

  it('rejects invalid JSON payloads with 400 Bad Request', async () => {
    const req = new EventEmitter() as unknown as IncomingMessage;
    req.method = 'POST';
    req.headers = {};

    let responseData = '';
    const res = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn().mockImplementation((chunk: string) => {
        responseData = chunk;
      }),
    } as unknown as ServerResponse;

    const runPromise = handler(req, res);
    req.emit('data', Buffer.from('invalid-json{{{'));
    req.emit('end');
    await runPromise;

    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(responseData);
    expect(parsed.error.code).toBe('invalid_json');
  });

  it('issues a signed guest cookie and executes chat request successfully', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-v1-testkey');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '你好！(nǐ hǎo - Hello!)' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { runPromise, res, getResponseData, headersMap } = createMockReqRes('POST', {
      messages: [{ role: 'user', content: 'Hello' }],
      context: { mode: 'chat', hskLevel: 1 },
    });

    await runPromise;

    expect(res.statusCode).toBe(200);
    expect(headersMap['set-cookie']).toBeDefined();
    expect(headersMap['set-cookie']).toContain('hanpath_guest_id=');

    const response = JSON.parse(getResponseData());
    expect(response.message).toBe('你好！(nǐ hǎo - Hello!)');
    expect(response.quota).toBeDefined();
    expect(response.quota.limit).toBe(5); // Guest tier
    expect(response.quota.remaining).toBe(4);
  });

  it('enforces guest quota limits and returns 429 when exhausted', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-v1-testkey');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OK' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Consume all 5 guest quota requests with valid signed cookie
    const signedGuestValue = signGuestId('test-guest-quota-exhaustion-id');
    const guestCookie = `hanpath_guest_id=${signedGuestValue}`;
    for (let i = 0; i < 5; i++) {
      const { runPromise } = createMockReqRes(
        'POST',
        { messages: [{ role: 'user', content: 'Msg' }] },
        { cookie: guestCookie }
      );
      await runPromise;
    }

    // 6th request should fail with 429
    const { runPromise: finalPromise, res: finalRes, getResponseData } = createMockReqRes(
      'POST',
      { messages: [{ role: 'user', content: 'Msg 6' }] },
      { cookie: guestCookie }
    );
    await finalPromise;

    expect(finalRes.statusCode).toBe(429);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error.code).toBe('quota_exceeded');
  });

  it('rejects forbidden browser origin with 403', async () => {
    const { runPromise, res, getResponseData } = createMockReqRes(
      'POST',
      { messages: [{ role: 'user', content: 'Hello' }] },
      { origin: 'https://malicious-attacker-site.com' }
    );

    await runPromise;

    expect(res.statusCode).toBe(403);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error.code).toBe('forbidden_origin');
  });

  it('accepts allowed preview origin and localhost origins', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-or-v1-testkey');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OK' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { runPromise, res } = createMockReqRes(
      'POST',
      { messages: [{ role: 'user', content: 'Hello' }] },
      { origin: 'https://hanpath-pr-9-test.vercel.app', 'content-type': 'application/json' }
    );

    await runPromise;
    expect(res.statusCode).toBe(200);
  });

  it('rejects unsupported Content-Type with 415', async () => {
    const { runPromise, res, getResponseData } = createMockReqRes(
      'POST',
      { messages: [{ role: 'user', content: 'Hello' }] },
      { 'content-type': 'text/plain' }
    );

    await runPromise;

    expect(res.statusCode).toBe(415);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error.code).toBe('unsupported_media_type');
  });

  it('rejects oversized messages with 413 payload_too_large', async () => {
    const oversizedMessage = 'a'.repeat(1500); // max is 1000
    const { runPromise, res, getResponseData } = createMockReqRes(
      'POST',
      { messages: [{ role: 'user', content: oversizedMessage }] }
    );

    await runPromise;

    expect(res.statusCode).toBe(413);
    const parsed = JSON.parse(getResponseData());
    expect(parsed.error.code).toBe('payload_too_large');
  });
});
