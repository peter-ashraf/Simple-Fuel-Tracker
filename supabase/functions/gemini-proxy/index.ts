import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { handleTestAction } from './lib/handlers/test.ts'
import { handleInsightsAction } from './lib/handlers/insights.ts'
import { handleMonthlyReportAction } from './lib/handlers/monthly-report.ts'
import { handleChatAction } from './lib/handlers/chat.ts'
import { handleQueryAction } from './lib/handlers/query.ts'
import { handleExportAction } from './lib/handlers/export.ts'
import { checkRateLimit, recordRateLimit } from './lib/rate-limiter.ts'
import { validateRequestSize } from './lib/validators.ts'
import { getCorsHeaders } from './lib/cors.ts'

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  // Get the request origin for CORS
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  // Temporary debug route: GET /_debug/ai-test
  if (req.method === 'GET' && new URL(req.url).pathname === '/_debug/ai-test') {
    // Only allow in dev or when explicit flag set
    const allow = Deno.env.get('AI_DEBUG_ALLOW_LOCAL') === 'true' || Deno.env.get('ENV') === 'development'
    if (!allow) return new Response('Not allowed', { status: 403, headers: corsHeaders })
    try {
      const { callHuggingFace } = await import('./lib/providers/huggingface.ts')
      const testPayload = {
        inputs: 'Say hello',
        parameters: {
          max_new_tokens: 100,
          temperature: 0.7
        }
      }
      const aiResult = await callHuggingFace(testPayload)
      return new Response(JSON.stringify({ ok: true, ai: aiResult }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (err: any) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate request size
    const sizeValidation = validateRequestSize(req)
    if (!sizeValidation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { code: 'REQUEST_TOO_LARGE', message: sizeValidation.message } 
        }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate user using Supabase auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check rate limit (persistent via Supabase storage)
    console.log('[Edge Function] Checking rate limit for user:', user.id)
    const rateLimitCheck = await checkRateLimit(supabase, user.id)
    console.log('[Edge Function] Rate limit check result:', rateLimitCheck)
    if (!rateLimitCheck.allowed) {
      await recordRateLimit(supabase, user.id, 'exceeded')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { 
            code: 'RATE_LIMITED', 
            message: 'Too many requests. Please try again later.',
            details: { retryAfter: rateLimitCheck.retryAfter }
          } 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { code: 'INVALID_REQUEST', message: 'Invalid JSON body' } 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, data, language = 'en' } = body

    // Validate action
    if (!action || !['test', 'insights', 'monthly-report', 'chat', 'query', 'export'].includes(action)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: { code: 'INVALID_REQUEST', message: 'Invalid action specified' } 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route to appropriate handler
    let result
    try {
      console.log('[Edge Function] Routing to action:', action)
      switch (action) {
        case 'test':
          result = await handleTestAction(data, language)
          break
        case 'insights':
          result = await handleInsightsAction(data, language)
          break
        case 'monthly-report':
          result = await handleMonthlyReportAction(data, language)
          break
        case 'chat':
          result = await handleChatAction(data, language)
          break
        case 'query':
          result = await handleQueryAction(data, language)
          break
        case 'export':
          result = await handleExportAction(data, language)
          break
        default:
          throw new Error('Invalid action')
      }

      console.log('[Edge Function] Handler result:', result)
      
      // Record successful request
      await recordRateLimit(supabase, user.id, 'success')

      return new Response(
        JSON.stringify({
          success: true,
          action,
          data: result
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (handlerError: any) {
      // Log message and first 5 stack lines for debugging (do not log env/secrets)
      console.error('[Edge Function] Handler error:', { message: handlerError?.message, stack: (handlerError?.stack || '').split('\n').slice(0,5) })

      // Record failed request
      await recordRateLimit(supabase, user.id, 'error')

      // Map known error messages to structured codes
      let code = 'INTERNAL_ERROR'
      const msg = handlerError?.message || 'An unexpected error occurred'
      if (msg.includes('MISSING_SECRET')) code = 'MISSING_SECRET'
      else if (msg.includes('HF_AUTH_FAILED')) code = 'HF_AUTH_FAILED'
      else if (msg.includes('HF_MODEL_NOT_FOUND')) code = 'HF_MODEL_NOT_FOUND'
      else if (msg.includes('HF_RESPONSE_PARSE_ERROR')) code = 'HF_RESPONSE_PARSE_ERROR'
      else if (msg.includes('HF_PROVIDER_ERROR')) code = 'HF_PROVIDER_ERROR'
      else if (msg.includes('HF_RATE_LIMITED')) code = 'HF_RATE_LIMITED'
      else if (msg.includes('HF_MODEL_LOADING')) code = 'HF_MODEL_LOADING'

      return new Response(
        JSON.stringify({
          success: false,
          error: { code, message: msg }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'An unexpected error occurred' 
        } 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
