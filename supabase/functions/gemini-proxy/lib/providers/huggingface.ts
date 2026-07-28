// Hugging Face AI provider implementation
// Uses Hugging Face Router (OpenAI-compatible API)

import { AIProvider, AIMessage, AIResponse } from '../ai.ts'

const HF_API_KEY = Deno.env.get('HF_API_KEY')
const HF_MODEL = Deno.env.get('HF_MODEL') || 'deepseek-ai/DeepSeek-V3:novita'
const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions'

// Hugging Face provider wrapper: add explicit env checks and structured logging
export async function callHuggingFace(payload: any) {
  try {
    const hfKey = Deno.env.get('HF_API_KEY')
    const hfModel = Deno.env.get('HF_MODEL') || 'deepseek-ai/DeepSeek-V3:novita'
    if (!hfKey) throw new Error('MISSING_SECRET: HF_API_KEY')

    const hfUrl = 'https://router.huggingface.co/v1/chat/completions'
    const res = await fetch(hfUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const text = await res.text()
    if (!res.ok) {
      // Truncate body to avoid logging secrets; log status and first 1000 chars
      console.error('[HF Provider] non-200 response', { status: res.status, body: text.slice(0, 1000) })
      if (res.status === 401 || res.status === 403) throw new Error('HF_AUTH_FAILED')
      if (res.status === 404) throw new Error('HF_MODEL_NOT_FOUND')
      if (res.status === 429) throw new Error('HF_RATE_LIMITED')
      if (res.status === 503) throw new Error('HF_MODEL_LOADING')
      throw new Error(`HF_PROVIDER_ERROR: ${res.status}`)
    }

    try {
      return JSON.parse(text)
    } catch (parseErr: any) {
      console.error('[HF Provider] JSON parse error', { message: parseErr.message, body: text.slice(0, 1000) })
      throw new Error('HF_RESPONSE_PARSE_ERROR')
    }
  } catch (err: any) {
    // Log message and short stack for debugging (no env values)
    console.error('[HF Provider] error', { message: err.message, stack: (err.stack || '').split('\n').slice(0,5) })
    throw err
  }
}

export class HuggingFaceProvider implements AIProvider {
  async generateResponse(messages: AIMessage[], timeoutMs: number = 30000): Promise<AIResponse> {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI provider request timeout')), timeoutMs)
      })

      // Prepare request body in OpenAI format
      const requestBody = {
        model: HF_MODEL,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        max_tokens: 1000,
        temperature: 0.7
      }

      // Race between API call and timeout
      const response = await Promise.race([
        callHuggingFace(requestBody),
        timeoutPromise
      ])

      // Parse OpenAI-compatible response
      const content = response.choices?.[0]?.message?.content || 'No response generated'
      
      return {
        text: content,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Hugging Face provider error:', error)
      
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
export const huggingFaceProvider = new HuggingFaceProvider()
