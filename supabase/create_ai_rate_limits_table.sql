-- Create table for AI API rate limiting
-- This table tracks API usage per user to prevent abuse

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start BIGINT NOT NULL,
  last_request BIGINT NOT NULL,
  last_status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS ai_rate_limits_user_id_idx ON public.ai_rate_limits(user_id);

-- Create index for cleanup of old records
CREATE INDEX IF NOT EXISTS ai_rate_limits_last_request_idx ON public.ai_rate_limits(last_request);

-- Enable Row Level Security
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only read their own rate limit records
CREATE POLICY "Users can read own rate limits"
  ON public.ai_rate_limits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Service role can insert rate limit records
CREATE POLICY "Service role can insert rate limits"
  ON public.ai_rate_limits
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Create policy: Service role can update rate limit records
CREATE POLICY "Service role can update rate limits"
  ON public.ai_rate_limits
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Create policy: Service role can delete rate limit records
CREATE POLICY "Service role can delete rate limits"
  ON public.ai_rate_limits
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER ai_rate_limits_updated_at_trigger
  BEFORE UPDATE ON public.ai_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_rate_limits_updated_at();

-- Function to clean up old rate limit records (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_ai_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM public.ai_rate_limits
  WHERE last_request < (EXTRACT(EPOCH FROM NOW()) * 1000) - (7 * 24 * 60 * 60 * 1000);
END;
$$ LANGUAGE plpgsql;

-- Comment on table
COMMENT ON TABLE public.ai_rate_limits IS 'Tracks AI API usage per user for rate limiting';
