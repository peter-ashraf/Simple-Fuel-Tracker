// Local test script for Hugging Face provider
// Run with: deno run --allow-net --allow-env supabase/functions/gemini-proxy/scripts/hf_local_test.ts

import { callHuggingFace } from '../lib/providers/huggingface.ts'

const run = async () => {
  try {
    console.log('Testing Hugging Face provider...')
    const testPayload = { 
      model: Deno.env.get('HF_MODEL') || 'meta-llama/Llama-3.2-3B-Instruct',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello' }
      ],
      max_tokens: 100,
      temperature: 0.7
    }
    const res = await callHuggingFace(testPayload)
    console.log('HF OK', JSON.stringify(res).slice(0, 1000))
  } catch (err: any) {
    console.error('HF test error', err.message)
  }
}

run()
