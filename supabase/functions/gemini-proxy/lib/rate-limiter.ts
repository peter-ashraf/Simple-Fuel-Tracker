// Persistent rate limiting using Supabase storage

const RATE_LIMIT_TABLE = 'ai_rate_limits'
const REQUESTS_PER_HOUR = 30
const HOUR_IN_MS = 60 * 60 * 1000

interface RateLimitCheck {
  allowed: boolean
  retryAfter?: number
}

interface RateLimitRecord {
  user_id: string
  request_count: number
  window_start: number
  last_request: number
}

export async function checkRateLimit(
  supabase: any,
  userId: string
): Promise<RateLimitCheck> {
  const now = Date.now()
  const windowStart = now - HOUR_IN_MS

  try {
    // Get current rate limit record
    const { data: existing, error } = await supabase
      .from(RATE_LIMIT_TABLE)
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = row not found, which is ok
      console.error('Rate limit check error:', error)
      // Allow request if rate limit check fails (fail open)
      return { allowed: true }
    }

    if (!existing) {
      // First request for this user
      return { allowed: true }
    }

    // Check if window has expired
    if (existing.window_start < windowStart) {
      // Window expired, reset counter
      return { allowed: true }
    }

    // Check if over limit
    if (existing.request_count >= REQUESTS_PER_HOUR) {
      const retryAfter = Math.ceil((existing.window_start + HOUR_IN_MS - now) / 1000)
      return { allowed: false, retryAfter }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Rate limit check exception:', error)
    // Allow request if rate limit check fails (fail open)
    return { allowed: true }
  }
}

export async function recordRateLimit(
  supabase: any,
  userId: string,
  status: 'success' | 'error' | 'exceeded'
): Promise<void> {
  const now = Date.now()
  const windowStart = now - HOUR_IN_MS

  try {
    // Get current record
    const { data: existing, error: fetchError } = await supabase
      .from(RATE_LIMIT_TABLE)
      .select('*')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Rate limit fetch error:', fetchError)
      return
    }

    if (!existing) {
      // Create new record
      await supabase
        .from(RATE_LIMIT_TABLE)
        .insert({
          user_id: userId,
          request_count: 1,
          window_start: windowStart,
          last_request: now,
          last_status: status
        })
    } else {
      // Update existing record
      const newCount = existing.window_start < windowStart 
        ? 1 
        : existing.request_count + 1

      await supabase
        .from(RATE_LIMIT_TABLE)
        .update({
          request_count: newCount,
          window_start: existing.window_start < windowStart ? windowStart : existing.window_start,
          last_request: now,
          last_status: status
        })
        .eq('user_id', userId)
    }
  } catch (error) {
    console.error('Rate limit record exception:', error)
  }
}
