// Monthly report handler

import { huggingFaceProvider } from '../providers/huggingface.ts'
import { buildMonthlyReportPrompt } from '../prompts.ts'
import { validateMonthlyStatsData } from '../validators.ts'

export async function handleMonthlyReportAction(data: any, language: string) {
  // Validate monthly stats data
  const validation = validateMonthlyStatsData(data.monthlyStats)
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  const messages = buildMonthlyReportPrompt(data.monthlyStats, language)
  const result = await huggingFaceProvider.generateResponse(messages)
  
  return {
    text: result.text,
    timestamp: result.timestamp,
  }
}
