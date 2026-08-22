\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id)
VALUES ('7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8');

INSERT INTO public.user_progress (user_id, snapshot, version)
VALUES (
    '7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8',
    '{"schemaVersion":4}'::JSONB,
    1
);

SELECT public.record_and_check_ai_quota(
    'user:7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8',
    50,
    10
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.ai_usage
        WHERE user_id = '7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8'
    ) THEN
        RAISE EXCEPTION 'Authenticated quota row was not associated with auth.users';
    END IF;
END;
$$;

DELETE FROM auth.users
WHERE id = '7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.user_progress
        WHERE user_id = '7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8'
    ) THEN
        RAISE EXCEPTION 'user_progress did not cascade on Auth deletion';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.ai_usage
        WHERE user_id = '7a3bb6a4-6fb7-4cc4-b33f-fbcfe95cdcc8'
    ) THEN
        RAISE EXCEPTION 'ai_usage did not cascade on Auth deletion';
    END IF;
END;
$$;

ROLLBACK;
