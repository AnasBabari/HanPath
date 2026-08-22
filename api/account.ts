import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveIdentity } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32 * 1024) {
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

  if (req.method !== 'DELETE') {
    res.statusCode = 405;
    res.setHeader('Allow', 'DELETE');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

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

  try {
    const rawText = await readBody(req);
    let payload: { confirm?: boolean } = {};
    if (rawText.trim()) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
        return;
      }
    }

    if (payload.confirm !== true) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Explicit confirmation required: { confirm: true }' }));
      return;
    }

    // 1. Delete user progress
    const { error: progErr } = await supabase
      .from('user_progress')
      .delete()
      .eq('user_id', identity.userId);

    if (progErr) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Failed to delete user progress: ${progErr.message}`,
        })
      );
      return;
    }

    // 2. Delete user AI usage
    const { error: aiErr } = await supabase
      .from('ai_usage')
      .delete()
      .eq('identifier', `user:${identity.userId}`);

    if (aiErr) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Failed to delete user AI usage: ${aiErr.message}`,
        })
      );
      return;
    }

    // 3. Delete Supabase auth user
    const { error: authDelErr } = await supabase.auth.admin.deleteUser(
      identity.userId
    );
    if (authDelErr) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: `Failed to delete auth user: ${authDelErr.message}`,
        })
      );
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, message: 'Account and associated data deleted' }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}
