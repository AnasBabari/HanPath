import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveIdentity } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { isAllowedOrigin } from './_lib/origin.js';
import { isJsonContentType } from './_lib/contentType.js';

const MAX_BODY_BYTES = 32 * 1024; // 32 KB

export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload Too Large') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', (chunk: Buffer | string) => {
      bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        req.destroy();
        reject(new PayloadTooLargeError(`Payload exceeds maximum limit of ${MAX_BODY_BYTES} bytes`));
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'DELETE') {
    res.statusCode = 405;
    res.setHeader('Allow', 'DELETE');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  if (!isAllowedOrigin(typeof req.headers.origin === 'string' ? req.headers.origin : null)) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: 'Forbidden: Invalid request origin' }));
    return;
  }

  const authHeader = req.headers['authorization'];
  const identity = await resolveIdentity(
    typeof authHeader === 'string' ? authHeader : null,
    null
  );

  if (identity.type === 'unavailable') {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Authentication service is temporarily unavailable' }));
    return;
  }

  if (identity.type !== 'user' || !identity.userId) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: identity.error || 'Unauthorized: Valid Bearer token required',
      })
    );
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: 'Database service unavailable' }));
    return;
  }

  try {
    let rawText = '';
    try {
      rawText = await readBody(req);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: 'Payload Too Large: Maximum account body size is 32KB' }));
        return;
      }
      throw err;
    }

    if (!rawText.trim()) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Explicit confirmation required: { confirm: true }' }));
      return;
    }

    if (!isJsonContentType(req.headers['content-type'])) {
      res.statusCode = 415;
      res.end(JSON.stringify({ error: 'Unsupported Media Type: Content-Type must be application/json' }));
      return;
    }

    let payload: { confirm?: boolean };
    try {
      payload = JSON.parse(rawText);
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
      return;
    }

    if (!payload || typeof payload !== 'object' || payload.confirm !== true) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Explicit confirmation required: { confirm: true }' }));
      return;
    }

    // The database migration attaches application rows to auth.users with
    // ON DELETE CASCADE. A hard Auth deletion therefore removes the account,
    // progress, and authenticated quota rows in one database transaction.
    const { error: authDelErr } = await supabase.auth.admin.deleteUser(
      identity.userId,
      false
    );

    if (authDelErr) {
      const reqId = crypto.randomUUID();
      console.error(`[AccountDeletion] Auth Admin deletion failed (reqId: ${reqId}):`, authDelErr);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: 'Account deletion encountered an issue',
          requestId: reqId,
        })
      );
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, message: 'Account and associated data deleted' }));
  } catch {
    const reqId = crypto.randomUUID();
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error', requestId: reqId }));
  }
}
