-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the user_progress table
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create the updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the user_progress table
DROP TRIGGER IF EXISTS set_updated_at ON public.user_progress;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for user_progress
-- SELECT: Users can only read their own progress
CREATE POLICY "Users can view their own progress" 
ON public.user_progress 
FOR SELECT 
USING (auth.uid() = user_id);

-- INSERT: Users can only insert rows for their own user_id
CREATE POLICY "Users can insert their own progress" 
ON public.user_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own progress
CREATE POLICY "Users can update their own progress" 
ON public.user_progress 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own progress
CREATE POLICY "Users can delete their own progress" 
ON public.user_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Create a secure, aggregate-only leaderboard view.
-- Never expose the private JSONB progress document to leaderboard readers.
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard WITH (security_invoker = off) AS
SELECT
    user_id,
    CASE
        WHEN (stats->>'totalXP') ~ '^[0-9]+$' THEN (stats->>'totalXP')::bigint
        ELSE 0::bigint
    END AS total_xp,
    CASE
        WHEN (stats->>'level') ~ '^[0-9]+$' THEN (stats->>'level')::integer
        ELSE 1
    END AS level,
    updated_at
FROM public.user_progress;

-- Grant read access to the view for authenticated and anonymous users
GRANT SELECT ON public.leaderboard TO authenticated, anon;
