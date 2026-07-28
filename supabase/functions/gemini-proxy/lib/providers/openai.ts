// OpenAI AI provider implementation
// Uses OpenAI Chat Completions API

import { AIProvider, AIMessage, AIResponse } from '../ai.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-3.5-turbo'
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

// OpenAI provider wrapper: add explicit env checks and structured logging
export async function callOpenAI(payload: any) {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-3.5-turbo'
    if (!apiKey) throw new Error('MISSING_SECRET: OPENAI_API_KEY')

    const apiUrl = 'https://api.openai.com/v1/chat/completions'
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const text = await res.text()
    if (!res.ok) {
      // Truncate body to avoid logging secrets; log status and first 1000 chars
      console.error('[OpenAI Provider] non-200 response', { status: res.status, body: text.slice(0, 1000) })
      if (res.status === 401 || res.status === 403) throw new Error('OPENAI_AUTH_FAILED')
      if (res.status === 404) throw new Error('OPENAI_MODEL_NOT_FOUND')
      if (res.status === 429) throw new Error('OPENAI_RATE_LIMITED')
      if (res.status === 400) throw new Error('OPENAI_BAD_REQUEST')
      throw new Error(`OPENAI_PROVIDER_ERROR: ${res.status}`)
    }

    try {
      return JSON.parse(text)
    } catch (parseErr: any) {
      console.error('[OpenAI Provider] JSON parse error', { message: parseErr.message, body: text.slice(0, 1000) })
      throw new Error('OPENAI_RESPONSE_PARSE_ERROR')
    }
  } catch (err: any) {
    // Log message and short stack for debugging (no env values)
    console.error('[OpenAI Provider] error', { message: err.message, stack: (err.stack || '').split('\n').slice(0,5) })
    throw err
  }
}

export class OpenAIProvider implements AIProvider {
  async generateResponse(messages: AIMessage[], timeoutMs: number = 30000): Promise<AIResponse> {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI provider request timeout')), timeoutMs)
      })

      // Prepare request body in OpenAI format
      const requestBody = {
        model: OPENAI_MODEL,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        max_tokens: 1000,
        temperature: 0.7
      }

      // Race between API call and timeout
      const response = await Promise.race([
        callOpenAI(requestBody),
        timeoutPromise
      ])

      // Parse OpenAI response
      const content = response.choices?.[0]?.message?.content || 'No response generated'
      
      return {
        text: content,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('OpenAI provider error:', error)
      
      if (error instanceof Error && error.message === 'AI provider request timeout') {
        throw new Error('Request to AI provider timed out')
      }
      
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Unknown AI provider error'
      )
    }
  }
}

// Export singleton instance
export const openAIProvider = new OpenAIProvider()
