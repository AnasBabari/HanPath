-- ==============================================================================
-- Migration: 20260822000002_atomic_progress_and_deletion.sql
-- Adds atomic transactional user progress update and account deletion functions
-- ==============================================================================

-- 1. Atomic User Progress Save Function with row-locking
CREATE OR REPLACE FUNCTION public.save_user_progress(
    p_user_id UUID,
    p_snapshot JSONB,
    p_expected_version BIGINT
)
RETURNS JSONB AS $$
DECLARE
    v_current public.user_progress%ROWTYPE;
    v_next_version BIGINT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Acquire exclusive row lock on existing record
    SELECT * INTO v_current
    FROM public.user_progress
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Case A: Row does not exist yet (Initial Creation)
    IF NOT FOUND THEN
        IF p_expected_version <> 0 THEN
            RETURN jsonb_build_object(
                'status', 'conflict',
                'current_version', 0,
                'snapshot', NULL,
                'updated_at', NULL
            );
        END IF;

        INSERT INTO public.user_progress (user_id, snapshot, version, updated_at)
        VALUES (p_user_id, p_snapshot, 1, v_now);

        RETURN jsonb_build_object(
            'status', 'success',
            'version', 1,
            'updated_at', v_now
        );
    END IF;

    -- Case B: Row exists, verify optimistic expectedVersion matches
    IF v_current.version <> p_expected_version THEN
        RETURN jsonb_build_object(
            'status', 'conflict',
            'current_version', v_current.version,
            'snapshot', v_current.snapshot,
            'updated_at', v_current.updated_at
        );
    END IF;

    -- Case C: Match verified, perform atomic increment
    v_next_version := v_current.version + 1;

    UPDATE public.user_progress
    SET snapshot = p_snapshot,
        version = v_next_version,
        updated_at = v_now
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'version', v_next_version,
        'updated_at', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic User Data Deletion Function
CREATE OR REPLACE FUNCTION public.delete_user_data(
    p_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
    DELETE FROM public.user_progress WHERE user_id = p_user_id;
    DELETE FROM public.ai_usage WHERE identifier = ('user:' || p_user_id::TEXT);
    RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Security Role Grants
REVOKE EXECUTE ON FUNCTION public.save_user_progress FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_user_data FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.save_user_progress TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_data TO service_role;
