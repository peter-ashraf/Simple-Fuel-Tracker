// Test connection handler

import { huggingFaceProvider } from '../providers/huggingface.ts'
import { buildTestPrompt } from '../prompts.ts'

export async function handleTestAction(data: any, language: string) {
  const messages = buildTestPrompt(data.testPrompt)
  const result = await huggingFaceProvider.generateResponse(messages)
  
  return {
    text: result.text,
    timestamp: result.timestamp,
  }
}
