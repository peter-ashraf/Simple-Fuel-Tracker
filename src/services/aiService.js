// AI service - communicates with Supabase Edge Function
// This is the single entry point for all AI features in the frontend
// Note: Edge Function name remains 'gemini-proxy' for backward compatibility,
// but the implementation is provider-agnostic (currently uses Hugging Face)

import { supabase } from '../lib/supabaseClient'

const EDGE_FUNCTION_NAME = 'gemini-proxy'

export const aiService = {
  /**
   * Test AI provider connection
   * @param {string} testPrompt - Optional custom test prompt
   * @returns {Promise<Object>} Response with text and timestamp
   */
  async testConnection(testPrompt = null) {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'test',
          data: { testPrompt },
        },
      })

      if (error) {
        console.error('[AI Service] Test connection error:', error)
        throw new Error(error.message || 'Failed to test AI connection')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'AI test failed')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Test connection exception:', error)
      throw error
    }
  },

  /**
   * Generate AI insights for dashboard
   * @param {Object} stats - Prepared statistics object
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with text and timestamp
   */
  async generateInsights(stats, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'insights',
          data: { stats },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Generate insights error:', error)
        throw new Error(error.message || 'Failed to generate insights')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to generate insights')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Generate insights exception:', error)
      throw error
    }
  },

  /**
   * Generate AI monthly report
   * @param {Object} monthlyStats - Prepared monthly statistics object
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with text and timestamp
   */
  async generateMonthlyReport(monthlyStats, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'monthly-report',
          data: { monthlyStats },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Generate monthly report error:', error)
        throw new Error(error.message || 'Failed to generate monthly report')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to generate monthly report')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Generate monthly report exception:', error)
      throw error
    }
  },

  /**
   * Send chat message to AI with conversation history and stats context
   * @param {string} message - User's message
   * @param {Array} conversationHistory - Array of previous messages
   * @param {Object} stats - Current vehicle statistics for context
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with text and timestamp
   */
  async sendChatMessage(message, conversationHistory = [], stats = null, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'chat',
          data: {
            message,
            conversationHistory,
            stats,
          },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Chat message error:', error)
        throw new Error(error.message || 'Failed to send chat message')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to get AI response')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Chat message exception:', error)
      throw error
    }
  },

  /**
   * Execute natural language query
   * @param {string} queryText - Natural language query text
   * @param {Object} parsedQuery - Parsed query object from queryParser
   * @param {Object} queryResults - Results from queryExecutor
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with text and timestamp
   */
  async executeQuery(queryText, parsedQuery, queryResults, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'query',
          data: {
            query: parsedQuery,
            results: queryResults,
            originalText: queryText,
          },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Query error:', error)
        throw new Error(error.message || 'Failed to execute query')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to get query response')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Query exception:', error)
      throw error
    }
  },

  /**
   * Get predictions for vehicle
   * @param {string} vehicleId - Vehicle ID
   * @param {string} type - Prediction type ('fuelCost', 'maintenance', 'efficiency')
   * @param {Object} predictionData - Prepared prediction data
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with predictions
   */
  async getPredictions(vehicleId, type, predictionData, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'predictions',
          data: {
            vehicleId,
            type,
            predictionData,
          },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Predictions error:', error)
        throw new Error(error.message || 'Failed to get predictions')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to get predictions')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Predictions exception:', error)
      throw error
    }
  },

  /**
   * Get proactive insights for vehicle
   * @param {string} vehicleId - Vehicle ID
   * @param {Object} patternData - Pattern detection results
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with proactive insights
   */
  async getProactiveInsights(vehicleId, patternData, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'proactive',
          data: {
            vehicleId,
            patternData,
          },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Proactive insights error:', error)
        throw new Error(error.message || 'Failed to get proactive insights')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to get proactive insights')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Proactive insights exception:', error)
      throw error
    }
  },

  /**
   * Export data in specified format
   * @param {Object} exportData - Data to export
   * @param {string} format - Export format ('excel' or 'pdf')
   * @param {string} language - Language code ('en' or 'ar')
   * @returns {Promise<Object>} Response with download URL or base64 data
   */
  async exportData(exportData, format, language = 'en') {
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
        body: {
          action: 'export',
          data: {
            exportData,
            format,
          },
          language,
        },
      })

      if (error) {
        console.error('[AI Service] Export error:', error)
        throw new Error(error.message || 'Failed to export data')
      }

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to export data')
      }

      return data.data
    } catch (error) {
      console.error('[AI Service] Export exception:', error)
      throw error
    }
  },
}
