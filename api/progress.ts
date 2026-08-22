import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveIdentity } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

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
    res.end(JSON.stringify({ error: 'Unauthorized: Bearer token required' }));
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

      if (!payload || typeof payload !== 'object' || !payload.snapshot || typeof payload.expectedVersion !== 'number') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Field "snapshot" and numeric "expectedVersion" are required' }));
        return;
      }

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

      // Optimistic concurrency check
      if (existing && payload.expectedVersion !== currentVersion) {
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

      const nextVersion = currentVersion + 1;
      const now = new Date().toISOString();

      if (existing) {
        const { error: updateErr } = await supabase
          .from('user_progress')
          .update({
            snapshot: payload.snapshot,
            version: nextVersion,
            updated_at: now,
          })
          .eq('user_id', identity.userId);

        if (updateErr) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to update progress' }));
          return;
        }
      } else {
        const { error: insertErr } = await supabase
          .from('user_progress')
          .insert({
            user_id: identity.userId,
            snapshot: payload.snapshot,
            version: nextVersion,
            updated_at: now,
          });

        if (insertErr) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to insert progress' }));
          return;
        }
      }

      res.statusCode = 200;
      res.end(
        JSON.stringify({
          snapshot: payload.snapshot,
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
