-- ==============================================================================
-- Migration: 20260822140000_secure_user_functions.sql
-- Hardened, search-path secured atomic user progress save and account deletion
-- ==============================================================================

-- 1. Hardened Atomic User Progress Save Function
-- Secure search path: empty search path prevents search-path hijacking attacks.
CREATE OR REPLACE FUNCTION public.save_user_progress(
    p_user_id UUID,
    p_snapshot JSONB,
    p_expected_version BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current public.user_progress%ROWTYPE;
    v_next_version BIGINT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Acquire exclusive row lock if record already exists
    SELECT * INTO v_current
    FROM public.user_progress
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Case A: Record does not exist yet (Initial Creation)
    IF NOT FOUND THEN
        IF p_expected_version <> 0 THEN
            RETURN jsonb_build_object(
                'status', 'conflict',
                'current_version', 0,
                'snapshot', NULL,
                'updated_at', NULL
            );
        END IF;

        BEGIN
            INSERT INTO public.user_progress (user_id, snapshot, version, updated_at)
            VALUES (p_user_id, p_snapshot, 1, v_now);

            RETURN jsonb_build_object(
                'status', 'success',
                'version', 1,
                'updated_at', v_now
            );
        EXCEPTION WHEN unique_violation THEN
            -- Simultaneous creation occurred, re-fetch the concurrent record
            SELECT * INTO v_current
            FROM public.user_progress
            WHERE user_id = p_user_id;

            RETURN jsonb_build_object(
                'status', 'conflict',
                'current_version', v_current.version,
                'snapshot', v_current.snapshot,
                'updated_at', v_current.updated_at
            );
        END;
    END IF;

    -- Case B: Record exists, optimistic version mismatch
    IF v_current.version <> p_expected_version THEN
        RETURN jsonb_build_object(
            'status', 'conflict',
            'current_version', v_current.version,
            'snapshot', v_current.snapshot,
            'updated_at', v_current.updated_at
        );
    END IF;

    -- Case C: Match verified, increment version and update snapshot
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
$$;

-- 2. Hardened Atomic Account Deletion Function
CREATE OR REPLACE FUNCTION public.delete_user_data(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.user_progress WHERE user_id = p_user_id;
    DELETE FROM public.ai_usage WHERE identifier = ('user:' || p_user_id::TEXT);
    RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- 3. Strict Security Role Grants
REVOKE ALL ON FUNCTION public.save_user_progress(UUID, JSONB, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_user_data(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_user_progress(UUID, JSONB, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_data(UUID) TO service_role;

-- ==============================================================================
-- Rollback Instructions:
-- To revert this migration, execute:
-- DROP FUNCTION IF EXISTS public.save_user_progress(UUID, JSONB, BIGINT);
-- DROP FUNCTION IF EXISTS public.delete_user_data(UUID);
-- ==============================================================================
