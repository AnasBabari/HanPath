-- ==============================================================================
-- HànPath Supabase Production Schema & Security Policies (v4)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the user_progress table with explicit BIGINT versioning
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the ai_usage table for atomic rate-limiting and quotas
CREATE TABLE IF NOT EXISTS public.ai_usage (
    identifier TEXT PRIMARY KEY,
    daily_count INT NOT NULL DEFAULT 0,
    minute_count INT NOT NULL DEFAULT 0,
    last_reset_day DATE NOT NULL DEFAULT CURRENT_DATE,
    last_reset_minute TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Trigger for updated_at maintenance
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
RETURNS JSONB AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_now TIMESTAMPTZ := NOW();
    v_row public.ai_usage%ROWTYPE;
    v_allowed BOOLEAN := FALSE;
    v_remaining_daily INT := 0;
    v_retry_after INT := 0;
    v_reset_at TIMESTAMPTZ;
BEGIN
    v_reset_at := (v_today + INTERVAL '1 day');

    -- Insert initial row if not existing
    INSERT INTO public.ai_usage (identifier, daily_count, minute_count, last_reset_day, last_reset_minute)
    VALUES (p_identifier, 0, 0, v_today, v_now)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Strict Service-Role Only Permissions
-- Revoke all direct client access from anon and authenticated roles
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_progress FROM anon, authenticated, public;
REVOKE ALL ON public.ai_usage FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.record_and_check_ai_quota FROM anon, authenticated, public;

-- Grant access exclusively to service_role (used by serverless Vercel backend)
GRANT ALL ON public.user_progress TO service_role;
GRANT ALL ON public.ai_usage TO service_role;
GRANT EXECUTE ON FUNCTION public.record_and_check_ai_quota TO service_role;

-- Drop legacy leaderboard view if exists
DROP VIEW IF EXISTS public.leaderboard;
