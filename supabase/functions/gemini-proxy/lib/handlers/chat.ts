// Chat handler forconversational AI prompts
// Handles user questions about their fuel data with context

import { huggingFaceProvider } from '../providers/huggingface.ts'
import { buildChatPrompt } from '../prompts.ts'
import { validateStatsData } from '../validators.ts'

export async function handleChatAction(data: any, language: string) {
  const { message, conversationHistory, stats } = data

  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message')
  }

  // Build chat prompt with conversation history and fuel data context
  const messages = buildChatPrompt(message, conversationHistory, stats, language)
  
  const result = await huggingFaceProvider.generateResponse(messages)
  
  return {
    text: result.text,
    timestamp: result.timestamp,
  }
}
