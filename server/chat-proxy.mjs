import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOKENS = 1_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_MAX_KEYS = 1_000;
const ALLOWED_MODELS = new Set([
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemma-2-9b-it:free',
]);
const rateLimiters = new Map();

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 128) || 'unknown';
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown').slice(0, 128);
}

function allowRequest(req, now = Date.now()) {
  const key = clientKey(req);
  const current = rateLimiters.get(key);
  if (!current || current.resetAt <= now) {
    if (rateLimiters.size >= RATE_LIMIT_MAX_KEYS) {
      for (const [entryKey, entry] of rateLimiters) {
        if (entry.resetAt <= now) rateLimiters.delete(entryKey);
      }
      if (rateLimiters.size >= RATE_LIMIT_MAX_KEYS) rateLimiters.clear();
    }
    rateLimiters.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)) };
  }
  return { allowed: true, retryAfter: 0 };
}

function parseBody(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!ALLOWED_MODELS.has(value.model) || !Array.isArray(value.messages)) return null;
    if (value.messages.length === 0 || value.messages.length > MAX_MESSAGES) return null;
    const messages = value.messages.map((message) => {
      if (!message || typeof message !== 'object') return null;
      if (!['system', 'user', 'assistant'].includes(message.role)) return null;
      if (typeof message.content !== 'string' || message.content.length === 0 || message.content.length > MAX_MESSAGE_CHARS) return null;
      return { role: message.role, content: message.content };
    });
    if (messages.some((message) => message === null)) return null;
    if (value.temperature !== undefined && (!Number.isFinite(value.temperature) || value.temperature < 0 || value.temperature > 2)) return null;
    if (value.max_tokens !== undefined && (!Number.isInteger(value.max_tokens) || value.max_tokens < 1 || value.max_tokens > MAX_TOKENS)) return null;
    return {
      model: value.model,
      messages,
      temperature: value.temperature ?? 0.7,
      max_tokens: value.max_tokens ?? 500,
    };
  } catch {
    return null;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  const limit = allowRequest(req);
  if (!limit.allowed) {
    sendJson(res, 429, { code: 'rate_limited', error: 'Too many AI requests', retry_after_seconds: limit.retryAfter }, { 'Retry-After': String(limit.retryAfter) });
    return;
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { code: 'ai_not_configured', error: 'AI service is not configured' });
    return;
  }
  let raw;
  try {
    raw = await readRequestBody(req);
  } catch (error) {
    sendJson(res, error instanceof Error && error.message === 'request_too_large' ? 413 : 400, { error: 'Invalid chat request' });
    return;
  }
  const body = parseBody(raw);
  if (!body) {
    sendJson(res, 400, { error: 'Invalid chat request' });
    return;
  }
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://hanpath.com',
        'X-Title': 'HànPath Learning App',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      sendJson(res, response.status === 429 ? 429 : 502, { error: 'Upstream AI request failed' });
      return;
    }
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      sendJson(res, 502, { error: 'Upstream AI returned an invalid response' });
      return;
    }
    sendJson(res, 200, data);
  } catch {
    sendJson(res, 502, { error: 'Unable to reach the upstream AI service' });
  }
}

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const candidate = path.resolve(DIST_DIR, `.${requested}`);
  if (!candidate.startsWith(`${DIST_DIR}${path.sep}`)) {
    sendJson(res, 400, { error: 'Invalid path' });
    return;
  }
  try {
    const stat = await readFile(candidate);
    const type = MIME_TYPES[path.extname(candidate)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': candidate.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' });
    res.end(stat);
  } catch {
    const index = await readFile(path.join(DIST_DIR, 'index.html')).catch(() => null);
    if (!index) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(index);
  }
}

export function createChatProxyServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/healthz') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }
    if (url.pathname === '/api/chat') {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
        return;
      }
      await handleChat(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    await serveStatic(req, res, decodeURIComponent(url.pathname));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createChatProxyServer().listen(PORT, '0.0.0.0', () => {
    console.log(`HànPath server listening on port ${PORT}`);
  });
}
