-- ==============================================================================
-- Migration: Atomic Auth/account deletion through validated foreign-key cascades
-- ==============================================================================

ALTER TABLE public.ai_usage
    ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.ai_usage
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Associate pre-existing authenticated quota rows with their Auth user.
UPDATE public.ai_usage AS usage
SET user_id = SUBSTRING(usage.identifier FROM 6)::UUID
WHERE usage.user_id IS NULL
  AND usage.identifier ~* '^user:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      WHERE auth_user.id = SUBSTRING(usage.identifier FROM 6)::UUID
  );

-- A previously interrupted deployment must not leave orphan user IDs that
-- prevent the foreign key from being validated on the next migration run.
UPDATE public.ai_usage AS usage
SET user_id = NULL
WHERE usage.user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      WHERE auth_user.id = usage.user_id
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.user_progress'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) THEN
        ALTER TABLE public.user_progress
            ADD CONSTRAINT user_progress_user_id_auth_users_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.ai_usage'::regclass
          AND contype = 'f'
          AND confrelid = 'auth.users'::regclass
    ) THEN
        ALTER TABLE public.ai_usage
            ADD CONSTRAINT ai_usage_user_id_auth_users_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ai_usage_user_id_idx
    ON public.ai_usage(user_id)
    WHERE user_id IS NOT NULL;

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

REVOKE ALL ON FUNCTION public.handle_updated_at()
    FROM PUBLIC, anon, authenticated;

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
    v_reset_at TIMESTAMPTZ := v_today + INTERVAL '1 day';
    v_user_id UUID := NULL;
BEGIN
    IF p_identifier ~* '^user:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        v_user_id := SUBSTRING(p_identifier FROM 6)::UUID;
    END IF;

    INSERT INTO public.ai_usage (
        identifier, user_id, daily_count, minute_count, last_reset_day, last_reset_minute
    )
    VALUES (p_identifier, v_user_id, 0, 0, v_today, v_now)
    ON CONFLICT (identifier) DO NOTHING;

    SELECT * INTO v_row
    FROM public.ai_usage
    WHERE identifier = p_identifier
    FOR UPDATE;

    IF v_row.last_reset_day < v_today THEN
        v_row.daily_count := 0;
        v_row.last_reset_day := v_today;
    END IF;

    IF v_row.last_reset_minute < (v_now - INTERVAL '1 minute') THEN
        v_row.minute_count := 0;
        v_row.last_reset_minute := v_now;
    END IF;

    IF v_row.daily_count >= p_max_daily THEN
        v_remaining_daily := 0;
        v_retry_after := EXTRACT(EPOCH FROM (v_reset_at - v_now))::INT;
    ELSIF v_row.minute_count >= p_max_minute THEN
        v_remaining_daily := GREATEST(0, p_max_daily - v_row.daily_count);
        v_retry_after := GREATEST(
            1,
            EXTRACT(EPOCH FROM ((v_row.last_reset_minute + INTERVAL '1 minute') - v_now))::INT
        );
    ELSE
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

REVOKE ALL ON FUNCTION public.record_and_check_ai_quota(TEXT, INT, INT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_and_check_ai_quota(TEXT, INT, INT)
    TO service_role;

-- The old two-step API could remove application data while leaving Auth active.
DROP FUNCTION IF EXISTS public.delete_user_data(UUID);
