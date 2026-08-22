import type { ProgressSnapshotV4, SyncEnvelope } from '../types';
import { mergeGuestWithCloud } from './progressMerge';
import { validateProgressSnapshotV4 } from './progressSchema';

export interface SyncResult {
  success: boolean;
  envelope?: SyncEnvelope;
  mergedSnapshot?: ProgressSnapshotV4;
  error?: string;
  isConflictResolved?: boolean;
}

/**
 * Fetches current cloud progress envelope via authenticated GET /api/progress
 */
export async function fetchCloudProgress(authToken: string): Promise<SyncEnvelope | null> {
  if (!authToken) return null;

  try {
    const response = await fetch('/api/progress', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch cloud progress (HTTP ${response.status})`);
    }

    const data = (await response.json()) as SyncEnvelope;
    const validated = validateProgressSnapshotV4(data.snapshot);
    if (!validated.success || !validated.data) {
      throw new Error('Cloud snapshot validation failed');
    }

    return {
      snapshot: validated.data,
      version: Number(data.version) || 1,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch (err: unknown) {
    console.warn('fetchCloudProgress error:', err);
    throw err;
  }
}

/**
 * Pushes local snapshot to PUT /api/progress with optimistic concurrency control.
 * On 409 Conflict, automatically executes mergeGuestWithCloud and retries once.
 */
export async function syncCloudProgress(
  authToken: string,
  localSnapshot: ProgressSnapshotV4,
  expectedVersion: number,
  isRetry = false
): Promise<SyncResult> {
  if (!authToken) {
    return { success: false, error: 'Authentication token required' };
  }

  try {
    const response = await fetch('/api/progress', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        snapshot: localSnapshot,
        expectedVersion,
      }),
    });

    if (response.status === 409) {
      const conflictData = (await response.json()) as {
        currentEnvelope?: SyncEnvelope;
      };

      if (conflictData.currentEnvelope && !isRetry) {
        // Re-merge local dirty state with latest cloud state
        const resolved = mergeGuestWithCloud(
          localSnapshot,
          conflictData.currentEnvelope.snapshot,
          true // Local preferences win on conflict
        );

        // Retry sync once with the latest version
        const retryResult = await syncCloudProgress(
          authToken,
          resolved,
          conflictData.currentEnvelope.version,
          true
        );

        return {
          ...retryResult,
          mergedSnapshot: resolved,
          isConflictResolved: true,
        };
      }

      return { success: false, error: 'Cloud sync conflict could not be resolved automatically.' };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { success: false, error: `Cloud sync failed (HTTP ${response.status}): ${errorText}` };
    }

    const envelope = (await response.json()) as SyncEnvelope;
    return {
      success: true,
      envelope,
      mergedSnapshot: envelope.snapshot,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error during cloud sync';
    return { success: false, error: msg };
  }
}

/**
 * Permanently deletes user cloud progress and auth account via DELETE /api/account
 */
export async function deleteCloudAccount(authToken: string): Promise<{ success: boolean; error?: string }> {
  if (!authToken) {
    return { success: false, error: 'Authentication token required' };
  }

  try {
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ confirm: true }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return { success: false, error: err.error || 'Failed to delete account' };
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error during deletion' };
  }
}
