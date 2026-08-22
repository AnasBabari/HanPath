-- ==============================================================================
-- HànPath HSK 3.0 Production Database Schema
-- Version: 4.0.0
-- Security: Service-role only access. RLS enabled on all tables.
-- ==============================================================================

-- 1. Progress Table (Level-scoped JSONB snapshot + monotonic version counter)
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. AI Usage & Quota Rate-limiting Table
CREATE TABLE IF NOT EXISTS public.ai_usage (
    identifier TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_count INT NOT NULL DEFAULT 0,
    minute_count INT NOT NULL DEFAULT 0,
    last_reset_day DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reset_minute TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Automatic updated_at Trigger Function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_progress_updated_at ON public.user_progress;
CREATE TRIGGER set_user_progress_updated_at
    BEFORE UPDATE ON public.user_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_ai_usage_updated_at ON public.ai_usage;
CREATE TRIGGER set_ai_usage_updated_at
    BEFORE UPDATE ON public.ai_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Atomic AI Quota Check and Record Function
CREATE OR REPLACE FUNCTION public.record_and_check_ai_quota(
    p_identifier TEXT,
    p_max_daily INT,
    p_max_minute INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_now TIMESTAMPTZ := NOW();
    v_row public.ai_usage%ROWTYPE;
    v_allowed BOOLEAN := FALSE;
    v_remaining_daily INT := 0;
    v_retry_after INT := 0;
    v_reset_at TIMESTAMPTZ;
    v_user_id UUID := NULL;
BEGIN
    v_reset_at := (v_today + INTERVAL '1 day');

    IF p_identifier ~* '^user:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        v_user_id := SUBSTRING(p_identifier FROM 6)::UUID;
    END IF;

    -- Insert initial row if not existing
    INSERT INTO public.ai_usage (identifier, user_id, daily_count, minute_count, last_reset_day, last_reset_minute)
    VALUES (p_identifier, v_user_id, 0, 0, v_today, v_now)
    ON CONFLICT (identifier) DO NOTHING;

    -- Lock row for update
    SELECT * INTO v_row
    FROM public.ai_usage
    WHERE identifier = p_identifier
    FOR UPDATE;

    -- Reset day counter if day changed
    IF v_row.last_reset_day < v_today THEN
        v_row.daily_count := 0;
        v_row.last_reset_day := v_today;
    END IF;

    -- Reset minute counter if minute passed
    IF v_row.last_reset_minute < (v_now - INTERVAL '1 minute') THEN
        v_row.minute_count := 0;
        v_row.last_reset_minute := v_now;
    END IF;

    -- Evaluate daily quota
    IF v_row.daily_count >= p_max_daily THEN
        v_allowed := FALSE;
        v_remaining_daily := 0;
        v_retry_after := EXTRACT(EPOCH FROM (v_reset_at - v_now))::INT;
    -- Evaluate minute quota
    ELSIF v_row.minute_count >= p_max_minute THEN
        v_allowed := FALSE;
        v_remaining_daily := GREATEST(0, p_max_daily - v_row.daily_count);
        v_retry_after := EXTRACT(EPOCH FROM ((v_row.last_reset_minute + INTERVAL '1 minute') - v_now))::INT;
        IF v_retry_after < 1 THEN v_retry_after := 1; END IF;
    ELSE
        -- Allowed, increment counters
        v_row.daily_count := v_row.daily_count + 1;
        v_row.minute_count := v_row.minute_count + 1;
        v_allowed := TRUE;
        v_remaining_daily := GREATEST(0, p_max_daily - v_row.daily_count);

        UPDATE public.ai_usage
        SET daily_count = v_row.daily_count,
            minute_count = v_row.minute_count,
            last_reset_day = v_row.last_reset_day,
            last_reset_minute = v_row.last_reset_minute,
            updated_at = v_now
        WHERE identifier = p_identifier;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'remaining_daily', v_remaining_daily,
        'reset_at', v_reset_at,
        'retry_after_seconds', v_retry_after
    );
END;
$$;

-- 5. Atomic User Progress Save Function with row-locking and concurrency safety
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

        BEGIN
            INSERT INTO public.user_progress (user_id, snapshot, version, updated_at)
            VALUES (p_user_id, p_snapshot, 1, v_now);

            RETURN jsonb_build_object(
                'status', 'success',
                'version', 1,
                'updated_at', v_now
            );
        EXCEPTION WHEN unique_violation THEN
            -- Re-fetch concurrent write
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
$$;

-- 6. Strict Service-Role Only Permissions
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_progress FROM anon, authenticated, public;
REVOKE ALL ON public.ai_usage FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.record_and_check_ai_quota FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.save_user_progress FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_updated_at FROM anon, authenticated, public;

-- Grant access exclusively to service_role (used by serverless Vercel backend)
GRANT ALL ON public.user_progress TO service_role;
GRANT ALL ON public.ai_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.record_and_check_ai_quota TO service_role;
GRANT EXECUTE ON FUNCTION public.save_user_progress TO service_role;

-- Drop legacy leaderboard view if exists
DROP VIEW IF EXISTS public.leaderboard;
