import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveIdentity } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { validateProgressSnapshotV4 } from '../src/utils/progressSchema.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 512 * 1024) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
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

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          snapshot: data.snapshot,
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

  if (req.method === 'PUT') {
    try {
      const rawText = await readBody(req);
      let payload: { snapshot?: unknown; expectedVersion?: number };
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
        typeof payload.expectedVersion !== 'number'
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Field "snapshot" (object) and numeric "expectedVersion" are required',
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

      // Check current record in DB
      const { data: existing, error: selectErr } = await supabase
        .from('user_progress')
        .select('snapshot, version, updated_at')
        .eq('user_id', identity.userId)
        .maybeSingle();

      if (selectErr) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to check current progress' }));
        return;
      }

      const currentVersion = existing ? Number(existing.version) : 0;

      // Concurrency check before write
      if (existing && expectedVersion !== currentVersion) {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            error: 'Conflict: Version mismatch',
            currentEnvelope: {
              snapshot: existing.snapshot,
              version: currentVersion,
              updatedAt: existing.updated_at,
            },
          })
        );
        return;
      }

      if (!existing && expectedVersion !== 0) {
        res.statusCode = 409;
        res.end(
          JSON.stringify({
            error: 'Conflict: Initial progress record requires expectedVersion 0',
            currentEnvelope: null,
          })
        );
        return;
      }

      const nextVersion = currentVersion + 1;
      const now = new Date().toISOString();

      if (existing) {
        // Atomic update conditioned on both user_id AND version
        const { data: updatedData, error: updateErr } = await supabase
          .from('user_progress')
          .update({
            snapshot: validSnapshot,
            version: nextVersion,
            updated_at: now,
          })
          .eq('user_id', identity.userId)
          .eq('version', expectedVersion)
          .select('snapshot, version, updated_at');

        if (updateErr) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to update progress' }));
          return;
        }

        // If 0 rows updated, concurrent write occurred between select and update
        if (!updatedData || updatedData.length === 0) {
          const { data: reFetched } = await supabase
            .from('user_progress')
            .select('snapshot, version, updated_at')
            .eq('user_id', identity.userId)
            .maybeSingle();

          res.statusCode = 409;
          res.end(
            JSON.stringify({
              error: 'Conflict: Concurrent update detected',
              currentEnvelope: reFetched
                ? {
                    snapshot: reFetched.snapshot,
                    version: Number(reFetched.version),
                    updatedAt: reFetched.updated_at,
                  }
                : null,
            })
          );
          return;
        }
      } else {
        // Initial insert
        const { error: insertErr } = await supabase
          .from('user_progress')
          .insert({
            user_id: identity.userId,
            snapshot: validSnapshot,
            version: 1,
            updated_at: now,
          });

        if (insertErr) {
          // If unique conflict on insert, fetch existing and return 409
          const { data: reFetched } = await supabase
            .from('user_progress')
            .select('snapshot, version, updated_at')
            .eq('user_id', identity.userId)
            .maybeSingle();

          if (reFetched) {
            res.statusCode = 409;
            res.end(
              JSON.stringify({
                error: 'Conflict: Concurrent creation detected',
                currentEnvelope: {
                  snapshot: reFetched.snapshot,
                  version: Number(reFetched.version),
                  updatedAt: reFetched.updated_at,
                },
              })
            );
            return;
          }

          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to insert progress' }));
          return;
        }
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          snapshot: validSnapshot,
          version: nextVersion,
          updatedAt: now,
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
