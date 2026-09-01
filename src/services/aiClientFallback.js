// Client-side AI fallback to bypass edge function outages

const SYSTEM_PROMPT = `You are a fuel efficiency analyst for a vehicle tracking application. 
All statistics provided are already calculated by the application. 
Your role is ONLY to interpret and explain these statistics.
Never invent numbers, never estimate missing values, never recalculate statistics.
If information is missing or insufficient, explicitly state that.
Provide practical, actionable insights based on the data.`;

function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatCurrency(num) {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toFixed(2);
}

function formatMonthlySpending(spending, currency = 'currency units') {
  if (!spending || spending.length === 0) return '- No data available';
  return spending.map(m => `- ${m.month}: ${formatCurrency(m.total)} ${currency}`).join('\n');
}

function formatQueryResults(results) {
  if (!results.success) return `Error: ${results.error || 'Failed to execute query'}`;
  if (!results.data) return 'No data available for this query.';
  
  const data = results.data;
  const lines = [];
  
  if (data.totalCost !== undefined) lines.push(`Total Cost: ${data.totalCost.toFixed(2)}`);
  if (data.totalDistance !== undefined) lines.push(`Total Distance: ${data.totalDistance.toLocaleString()} km`);
  if (data.avgEfficiency !== undefined) lines.push(`Average Efficiency: ${data.avgEfficiency.toFixed(2)} km/L`);
  if (data.fillUpCount !== undefined) lines.push(`Number of Fill-ups: ${data.fillUpCount}`);
  if (data.totalLiters !== undefined) lines.push(`Total Liters: ${data.totalLiters.toFixed(2)}`);
  if (data.avgCostPerFill !== undefined) lines.push(`Average Cost per Fill: ${data.avgCostPerFill.toFixed(2)}`);
  
  return lines.length > 0 ? lines.join('\n') : 'Query executed successfully.';
}

export const aiClientFallback = {
  isAvailable: !!import.meta.env.VITE_HUGGINGFACE_API_KEY,
  
  async execute(messages) {
    if (!this.isAvailable) throw new Error("Fallback key not available");
    
    const HF_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;
    const HF_MODEL = "meta-llama/Llama-3.3-70B-Instruct";
    
    const res = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    
    if (!res.ok) throw new Error(`HF returned ${res.status}`);
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "No response generated";
    return { text: content, timestamp: Date.now() };
  },

  async testConnection() {
    return await this.execute([
      { role: 'system', content: 'You are a helpful AI assistant.' },
      { role: 'user', content: 'Say hello and tell me today\'s purpose in one sentence.' }
    ]);
  },

  async sendChatMessage(message, conversationHistory, stats, language) {
    const lang = language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.';
    
    let statsContext = '';
    if (stats) {
      statsContext = `\nCurrent Vehicle Statistics Context for ${stats.vehicleName || 'Vehicle'}:\n- Total Distance: ${formatNumber(stats.totalDistance)} km\n- Total Cost: ${formatCurrency(stats.totalCost)} \n- Number of Fill-ups: ${stats.fillUpCount}\nMonthly Spending:\n${formatMonthlySpending(stats.monthlySpending)}`;
    }

    const messages = [{
      role: 'system',
      content: `${SYSTEM_PROMPT}\n\n${lang}\n\nYou are having a conversation with a user about their vehicle fuel data. Answer their questions using the provided statistics context.\n${statsContext}`
    }];

    if (conversationHistory) {
      conversationHistory.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({ role: 'user', content: message });
    return await this.execute(messages);
  },

  async executeQuery(queryText, parsedQuery, queryResults, language, stats = null, predictiveContext = null) {
    const lang = language === 'ar' ? 'Respond in Arabic.' : 'Respond in English.';
    const formattedResults = formatQueryResults(queryResults);
    
    let statsContext = '';
    if (stats) {
      statsContext = `\n\nGlobal Vehicle Statistics (for context):\n- Overall Average Efficiency: ${formatNumber(stats.avgKmPerLiter)} km/L\n- Overall Cost per KM: ${formatCurrency(stats.costPerKm)}\n- Total Historical Cost: ${formatCurrency(stats.totalCost)}`;
    }

    let predictionContextStr = '';
    if (predictiveContext) {
      predictionContextStr = `\n\nPredictive Data (for forecasting/estimation queries):\n- Average Monthly Distance: ${formatNumber(predictiveContext.avgMonthlyDistance)} km\n- Average Monthly Cost: ${formatCurrency(predictiveContext.avgMonthlyCost)}\nMonthly History Breakdown (Cost & Distance):\n${predictiveContext.monthlyHistory ? predictiveContext.monthlyHistory.map(m => `- ${m.year}-${String(m.month).padStart(2, '0')}: Distance ${formatNumber(m.totalDistance)} km, Cost ${formatCurrency(m.totalCost)}`).join('\n') : 'N/A'}`;
    }
    
    const userContent = `${lang}\n\nThe user asked: "${queryText}"\n\nQuery Results (specific to requested filters):\n${formattedResults}\n\nInterpret these results and provide a clear, helpful response. If the query results are empty or the user is asking for a prediction or general estimate based on past history, use the Global Vehicle Statistics and Predictive Data provided in the system context to formulate your best answer.`;
    
    return await this.execute([
      { role: 'system', content: `${SYSTEM_PROMPT}\n${lang}\nYou are a data analyst interpreting query results.${statsContext}${predictionContextStr}` },
      { role: 'user', content: userContent }
    ]);
  },
  
  async generateInsights(stats, language) {
      return await this.execute([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze these stats and provide insights:\nTotal Distance: ${stats.totalDistance}\nTotal Cost: ${stats.totalCost}` }
      ]);
  },
  
  async generateMonthlyReport(monthlyStats, language) {
      return await this.execute([
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Generate a monthly report for:\nDistance: ${monthlyStats.totalDistance}\nCost: ${monthlyStats.totalFuelCost}` }
      ]);
  }
};
