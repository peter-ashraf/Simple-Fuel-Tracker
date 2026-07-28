// CORS configuration with specific allowed origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:5174',  // Alternative Vite dev server
  'http://localhost:3000',  // Alternative dev server
  'http://127.0.0.1:5173',  // Vite dev server (localhost variant)
  'http://127.0.0.1:5174',  // Alternative Vite dev server (localhost variant)
  'http://127.0.0.1:60861',  // Browser preview proxy
  'https://dyfskufkvmisxxeazmjl.supabase.co',  // Production Supabase
  // Add your production domain when deployed
]

/**
 * Get CORS headers for a specific request origin
 * Returns the requesting origin if it's in the allowlist, otherwise returns no origin header
 * @param {string | null} origin - The Origin header from the request
 * @returns {Object} CORS headers with single origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }

  // Only set Access-Control-Allow-Origin if the request origin is in the allowlist
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

// Legacy static headers for backward compatibility (deprecated)
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.join(', '),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400',
}
