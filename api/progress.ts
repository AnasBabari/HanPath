import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveIdentity } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { validateProgressSnapshotV4 } from '../src/utils/progressSchema.js';
import { isAllowedOrigin } from './_lib/origin.js';
import { isJsonContentType } from './_lib/contentType.js';

const MAX_BODY_BYTES = 512 * 1024; // 512 KB

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

  // GET /api/progress
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('snapshot, version, updated_at')
        .eq('user_id', identity.userId)
        .maybeSingle();

      if (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to retrieve progress' }));
        return;
      }

      if (!data) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'No cloud progress found' }));
        return;
      }

      // Validate stored snapshot before returning
      const validation = validateProgressSnapshotV4(data.snapshot);
      if (!validation.success || !validation.data) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Corrupt snapshot stored in database' }));
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          snapshot: validation.data,
          version: Number(data.version),
          updatedAt: data.updated_at,
        })
      );
      return;
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
      return;
    }
  }

  // PUT /api/progress
  if (req.method === 'PUT') {
    if (!isAllowedOrigin(typeof req.headers.origin === 'string' ? req.headers.origin : null)) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Forbidden: Invalid request origin' }));
      return;
    }

    if (!isJsonContentType(req.headers['content-type'])) {
      res.statusCode = 415;
      res.end(JSON.stringify({ error: 'Unsupported Media Type: Content-Type must be application/json' }));
      return;
    }

    try {
      let rawText: string;
      try {
        rawText = await readBody(req);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          res.statusCode = 413;
          res.end(JSON.stringify({ error: 'Payload Too Large: Maximum progress body size is 512KB' }));
          return;
        }
        throw err;
      }

      let payload: { snapshot?: unknown; expectedVersion?: unknown };
      try {
        payload = JSON.parse(rawText);
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Malformed JSON body' }));
        return;
      }

      if (
        !payload ||
        typeof payload !== 'object' ||
        payload.snapshot === undefined ||
        payload.snapshot === null ||
        typeof payload.expectedVersion !== 'number' ||
        !Number.isInteger(payload.expectedVersion) ||
        payload.expectedVersion < 0
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Field "snapshot" (object) and finite non-negative integer "expectedVersion" are required',
          })
        );
        return;
      }

      // Strict validation of the snapshot using the shared Zod schema
      const validation = validateProgressSnapshotV4(payload.snapshot);
      if (!validation.success || !validation.data) {
        res.statusCode = 422;
        res.end(
          JSON.stringify({
            error: 'Unprocessable Entity: Snapshot schema validation failed',
            details: validation.error,
          })
        );
        return;
      }

      const validSnapshot = validation.data;
      const expectedVersion = Number(payload.expectedVersion);

      // Execute atomic save_user_progress RPC function
      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'save_user_progress',
        {
          p_user_id: identity.userId,
          p_snapshot: validSnapshot,
          p_expected_version: expectedVersion,
        }
      );

      if (rpcErr) {
        const reqId = crypto.randomUUID();
        console.error(`[ProgressRPC] Failed save_user_progress (reqId: ${reqId}):`, rpcErr);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to save user progress', requestId: reqId }));
        return;
      }

      if (!rpcResult || typeof rpcResult !== 'object') {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Invalid response from database progress RPC' }));
        return;
      }

      const result = rpcResult as {
        status: 'success' | 'conflict';
        version?: number;
        updated_at?: string;
        current_version?: number;
        snapshot?: unknown;
      };

      if (result.status === 'conflict') {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            error: 'Conflict: Version mismatch',
            currentEnvelope:
              result.current_version && result.current_version > 0
                ? {
                    snapshot: result.snapshot,
                    version: Number(result.current_version),
                    updatedAt: result.updated_at,
                  }
                : null,
          })
        );
        return;
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          snapshot: validSnapshot,
          version: Number(result.version),
          updatedAt: result.updated_at,
        })
      );
      return;
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
      return;
    }
  }

  res.statusCode = 405;
  res.setHeader('Allow', 'GET, PUT');
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
