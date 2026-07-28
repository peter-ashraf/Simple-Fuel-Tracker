// Insights handler

import { huggingFaceProvider } from '../providers/huggingface.ts'
import { buildInsightsPrompt } from '../prompts.ts'
import { validateStatsData } from '../validators.ts'

export async function handleInsightsAction(data: any, language: string) {
  // Validate stats data
  const validation = validateStatsData(data.stats)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const messages = buildInsightsPrompt(data.stats, language)
  const result = await huggingFaceProvider.generateResponse(messages)
  
  return {
    text: result.text,
    timestamp: result.timestamp,
  }
}
