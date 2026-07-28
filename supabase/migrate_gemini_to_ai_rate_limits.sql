-- Migration script: Rename gemini_rate_limits to ai_rate_limits
-- This script migrates existing data and updates all references

-- Step 1: Create new ai_rate_limits table with same structure
-- (This is done by create_ai_rate_limits_table.sql)

-- Step 2: Migrate existing data from gemini_rate_limits to ai_rate_limits
INSERT INTO public.ai_rate_limits (user_id, request_count, window_start, last_request, last_status, created_at, updated_at)
SELECT user_id, request_count, window_start, last_request, last_status, created_at, updated_at
FROM public.gemini_rate_limits
ON CONFLICT (user_id) DO UPDATE SET
  request_count = EXCLUDED.request_count,
  window_start = EXCLUDED.window_start,
  last_request = EXCLUDED.last_request,
  last_status = EXCLUDED.last_status,
  updated_at = EXCLUDED.updated_at;

-- Step 3: Drop old gemini_rate_limits table
DROP TABLE IF EXISTS public.gemini_rate_limits CASCADE;

-- Step 4: Drop old trigger function if it exists
DROP FUNCTION IF EXISTS update_gemini_rate_limits_updated_at();
DROP FUNCTION IF EXISTS cleanup_old_gemini_rate_limits();
