// Prompt templates for different AI actions
// Returns OpenAI-compatible message arrays

import { AIMessage } from './ai.ts'

const SYSTEM_PROMPT = `You are a fuel efficiency analyst for a vehicle tracking application. 
All statistics provided are already calculated by the application. 
Your role is ONLY to interpret and explain these statistics.
Never invent numbers, never estimate missing values, never recalculate statistics.
If information is missing or insufficient, explicitly state that.
Provide practical, actionable insights based on the data.`

export function buildTestPrompt(customPrompt?: string): AIMessage[] {
  const userContent = customPrompt || 'Say hello and tell me today\'s purpose in one sentence.'
  
  return [
    {
      role: 'system',
      content: 'You are a helpful AI assistant.'
    },
    {
      role: 'user',
      content: userContent
    }
  ]
}

export function buildInsightsPrompt(stats: any, language: string): AIMessage[] {
  const lang = language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'
  const currency = stats.currency || 'currency units'
  const vehicleName = stats.vehicleName || 'Vehicle'
  
  const userContent = `${lang}

Analyze the following vehicle fuel statistics and provide 3-5 concise insights:

Vehicle: ${vehicleName}
- Total Distance: ${formatNumber(stats.totalDistance)} km
- Total Cost: ${formatCurrency(stats.totalCost)} ${currency}
- Average Efficiency: ${formatNumber(stats.avgKmPerLiter)} km/L
- Average Consumption: ${formatNumber(stats.avgL100km)} L/100km
- Cost per KM: ${formatCurrency(stats.costPerKm)} ${currency}/km
- Number of Fill-ups: ${stats.fillUpCount}
- Date Range: ${formatDate(stats.dateRange.start)} to ${formatDate(stats.dateRange.end)}

Monthly Spending:
${formatMonthlySpending(stats.monthlySpending, currency)}

Efficiency Trend (last 10 fill-ups):
${formatEfficiencyTrend(stats.efficiencyTrend)}

Focus on:
1. Efficiency trends and patterns
2. Cost optimization opportunities
3. Any unusual observations
4. Practical recommendations

Keep each insight under 50 words. Be specific and actionable.`
  
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: userContent
    }
  ]
}

export function buildMonthlyReportPrompt(stats: any, language: string): AIMessage[] {
  const lang = language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'
  const currency = stats.currency || 'currency units'
  
  const userContent = `${lang}

Generate a professional monthly fuel analysis report for the following statistics:

Vehicle: ${stats.vehicleName}
Period: ${stats.period}

Summary Statistics:
- Total Distance: ${formatNumber(stats.totalDistance)} km
- Total Fuel Cost: ${formatCurrency(stats.totalFuelCost)} ${currency}
- Average Efficiency: ${formatNumber(stats.avgEfficiency)} km/L
- Number of Fill-ups: ${stats.fillUpCount}
- Best Efficiency: ${formatNumber(stats.bestEfficiency)} km/L
- Worst Efficiency: ${formatNumber(stats.worstEfficiency)} km/L
- Cost per KM: ${formatCurrency(stats.costPerKm)} ${currency}/km
- Driving Days: ${stats.drivingDays}
- Average Daily Distance: ${formatNumber(stats.avgDailyDistance)} km

Monthly Spending:
${formatMonthlySpending(stats.monthlySpending, currency)}

Efficiency Trend:
${formatEfficiencyTrendWithDates(stats.efficiencyTrend)}

Generate a professional report that includes:
1. Executive summary (2-3 sentences)
2. Driving habits analysis
3. Fuel spending breakdown
4. Efficiency performance review
5. Notable trends or anomalies
6. Practical recommendations

Write in a professional, analytical tone. Use bullet points for clarity.`
  
  return [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: userContent
    }
  ]
}

export function buildChatPrompt(message: string, conversationHistory: any[], stats: any, language: string): AIMessage[] {
  const lang = language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'
  
  // Build context from stats if available
  let statsContext = ''
  if (stats) {
    const vehicleName = stats.vehicleName || 'Vehicle'
    const currency = stats.currency || 'currency units'
    
    statsContext = `

Current Vehicle Statistics Context for ${vehicleName}:
- Total Distance: ${formatNumber(stats.totalDistance)} km
- Total Cost: ${formatCurrency(stats.totalCost)} ${currency}
- Average Efficiency: ${formatNumber(stats.avgKmPerLiter)} km/L
- Average Consumption: ${formatNumber(stats.avgL100km)} L/100km
- Cost per KM: ${formatCurrency(stats.costPerKm)} ${currency}/km
- Number of Fill-ups: ${stats.fillUpCount}
- Date Range: ${formatDate(stats.dateRange.start)} to ${formatDate(stats.dateRange.end)}

Monthly Spending:
${formatMonthlySpending(stats.monthlySpending, currency)}`
  }

  // Build messages array with conversation history
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}

${lang}

You are having a conversation with a user about their vehicle fuel data. Answer their questions using the provided statistics context. If the user asks about something not covered by the data, politely explain that information is not available. Keep responses concise and helpful.

${statsContext}`
    }
  ]

  // Add conversation history (excluding the current message which will be added separately)
  if (conversationHistory && conversationHistory.length > 0) {
    conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    })
  }

  // Add current user message (without stats context since it's in system prompt)
  messages.push({
    role: 'user',
    content: message
  })

  return messages
}

// Helper functions for formatting
function formatNumber(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A'
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatCurrency(num: number): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A'
  return num.toFixed(2)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function formatMonthlySpending(spending: any[], currency: string = 'currency units'): string {
  if (!spending || spending.length === 0) return '- No data available'
  return spending.map(m => `- ${m.month}: ${formatCurrency(m.total)} ${currency}`).join('\n')
}

function formatEfficiencyTrend(trend: any[]): string {
  if (!trend || trend.length === 0) return '- No data available'
  return trend.map((t, i) => `${i + 1}. ${formatNumber(t.value)} km/L`).join('\n')
}

function formatEfficiencyTrendWithDates(trend: any[]): string {
  if (!trend || trend.length === 0) return '- No data available'
  return trend.map(t => `${formatDate(t.date)}: ${formatNumber(t.value)} km/L`).join('\n')
}

export function buildQueryPrompt(query: any, results: any, originalText: string, language: string): AIMessage[] {
  const lang = language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.'
  
  // Format results for display (hide raw JSON)
  const formattedResults = formatQueryResults(results)
  
  const userContent = `${lang}

The user asked: "${originalText}"

Query Analysis:
- Type: ${query.type}
- Date Range: ${query.dateRange ? `${query.dateRange.startDate} to ${query.dateRange.endDate}` : 'All time'}
- Vehicles: ${query.vehicleIds ? query.vehicleIds.length : 'All'}
- Metrics: ${query.metrics ? query.metrics.join(', ') : 'All'}

Query Results:
${formattedResults}

IMPORTANT: Use ONLY the data provided above. Do not make assumptions, estimate values, or perform additional calculations. If efficiency data (km/L) is provided, use it directly. If it's not provided, state that it's not available rather than estimating it. Never assume fuel prices or make up calculations.

Interpret these results and provide a clear, helpful response to the user's question. If the results show no data or an error, explain this to the user. If the results contain data, summarize the key findings in a conversational way. Keep the response concise and actionable. Do not include raw JSON or technical details in your response.`

  return [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}

${lang}

You are a data analyst for a vehicle tracking application. You receive structured query results and need to interpret them for the user in a natural, conversational way. Focus on the key insights and actionable information from the data. Never include raw JSON or technical data structures in your response. CRITICAL: Use only the data provided in the query results. Never estimate, assume, or calculate values that are not explicitly provided.`
    },
    {
      role: 'user',
      content: userContent
    }
  ]
}

function formatQueryResults(results: any): string {
  if (!results.success) {
    return `Error: ${results.error || 'Failed to execute query'}`
  }
  
  if (!results.data) {
    return 'No data available for this query.'
  }
  
  const data = results.data
  const lines: string[] = []
  
  // Format summary data
  if (data.totalCost !== undefined) {
    lines.push(`Total Cost: ${data.totalCost.toFixed(2)}`)
  }
  if (data.totalDistance !== undefined) {
    lines.push(`Total Distance: ${data.totalDistance.toLocaleString()} km`)
  }
  if (data.avgEfficiency !== undefined) {
    lines.push(`Average Efficiency: ${data.avgEfficiency.toFixed(2)} km/L`)
  }
  if (data.fillUpCount !== undefined) {
    lines.push(`Number of Fill-ups: ${data.fillUpCount}`)
  }
  if (data.totalLiters !== undefined) {
    lines.push(`Total Liters: ${data.totalLiters.toFixed(2)}`)
  }
  if (data.avgCostPerFill !== undefined) {
    lines.push(`Average Cost per Fill: ${data.avgCostPerFill.toFixed(2)}`)
  }
  if (data.bestEfficiency !== undefined) {
    lines.push(`Best Efficiency: ${data.bestEfficiency.toFixed(2)} km/L`)
  }
  if (data.worstEfficiency !== undefined) {
    lines.push(`Worst Efficiency: ${data.worstEfficiency.toFixed(2)} km/L`)
  }
  
  // Add data points count
  if (data.dataPoints !== undefined) {
    lines.push(`Data Points: ${data.dataPoints}`)
  }
  
  // Add monthly breakdown summary if available
  if (data.monthlyBreakdown && data.monthlyBreakdown.length > 0) {
    lines.push(`Monthly Data Points: ${data.monthlyBreakdown.length}`)
  }
  
  // Add vehicle comparison summary if available
  if (data.vehicles && data.vehicles.length > 0) {
    lines.push(`Vehicles Compared: ${data.vehicles.length}`)
  }
  
  return lines.length > 0 ? lines.join('\n') : 'Query executed successfully.'
}
