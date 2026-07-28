// Query handler for natural language data queries
// Processes query results and provides AI interpretation

import { huggingFaceProvider } from '../providers/huggingface.ts'
import { buildQueryPrompt } from '../prompts.ts'

export async function handleQueryAction(data: any, language: string) {
  const { query, results, originalText } = data

  if (!query || !results) {
    throw new Error('Invalid query or results')
  }

  // Build prompt with query context and results
  const messages = buildQueryPrompt(query, results, originalText, language)
  
  const aiResult = await huggingFaceProvider.generateResponse(messages)
  
  return {
    text: aiResult.text,
    timestamp: aiResult.timestamp,
    queryType: query.type,
    hasData: results.success && results.data !== null,
  }
}
