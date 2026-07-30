// Query Parser - Parse natural language questions into structured queries
// This module converts user questions into executable query objects

/**
 * Parse natural language query into structured object
 * @param {string} text - User's natural language query
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Object} Structured query with type, filters, entities
 */
export function parseQuery(text, conversationHistory = []) {
  // Extract context from previous queries
  const context = extractContextFromHistory(conversationHistory)
  
  const query = {
    originalText: text,
    type: detectQueryType(text),
    dateRange: extractDateRange(text),
    vehicleIds: extractVehicles(text),
    metrics: extractMetrics(text),
    filters: {},
    confidence: 0.5,
  }

  // For comparison queries, if fewer than 2 vehicles specified, use all available vehicles
  if (query.type === 'comparison' && (!query.vehicleIds || query.vehicleIds.length < 2)) {
    query.vehicleIds = getAllVehicleIds()
    console.log('[QueryParser] Comparison query with insufficient vehicles, using all vehicles:', query.vehicleIds)
  }

  // Merge context if current query references it
  mergeContext(query, context, text)

  // Extract additional filters based on query type
  if (query.type === 'cost') {
    query.filters.costRelated = true
  }
  if (query.type === 'efficiency') {
    query.filters.efficiencyRelated = true
  }
  if (query.type === 'maintenance') {
    query.filters.maintenanceRelated = true
  }

  // Calculate confidence based on how many entities were extracted
  let extractedCount = 0
  if (query.dateRange) extractedCount++
  if (query.vehicleIds && query.vehicleIds.length > 0) extractedCount++
  if (query.metrics && query.metrics.length > 0) extractedCount++
  
  query.confidence = Math.min(0.9, 0.3 + (extractedCount * 0.2))

  return query
}

/**
 * Extract context from conversation history
 * @param {Array} history - Conversation history
 * @returns {Object} Context from previous queries
 */
function extractContextFromHistory(history) {
  const context = {
    dateRange: null,
    vehicleIds: null,
    vehicleNames: [],
  }
  
  // Look at the last few user messages to extract context
  const recentUserMessages = history
    .filter(msg => msg.role === 'user')
    .slice(-3) // Last 3 user messages
    .reverse()
  
  console.log('[QueryParser] Extracting context from messages:', recentUserMessages.map(m => m.content))
  
  for (const msg of recentUserMessages) {
    const parsed = {
      dateRange: extractDateRange(msg.content),
      vehicleIds: extractVehicles(msg.content),
    }
    
    console.log('[QueryParser] Parsed from message:', parsed)
    
    // Use the most recent non-null values
    if (parsed.dateRange && !context.dateRange) {
      context.dateRange = parsed.dateRange
      console.log('[QueryParser] Set context dateRange:', context.dateRange)
    }
    if (parsed.vehicleIds && parsed.vehicleIds.length > 0 && !context.vehicleIds) {
      context.vehicleIds = parsed.vehicleIds
      console.log('[QueryParser] Set context vehicleIds:', context.vehicleIds)
    }
  }
  
  console.log('[QueryParser] Final context:', context)
  return context
}

/**
 * Merge context into current query if referenced
 * @param {Object} query - Current parsed query
 * @param {Object} context - Context from history
 * @param {string} text - Original query text
 */
function mergeContext(query, context, text) {
  const lowerText = text.toLowerCase()
  
  console.log('[QueryParser] Merging context. Query:', query, 'Context:', context, 'Text:', text)
  
  // Check if query references "same period", "that period", "this period", etc.
  const periodReferences = ['same period', 'that period', 'this period', 'the same time', 'during that time', 'in that period']
  const referencesPeriod = periodReferences.some(ref => lowerText.includes(ref))
  
  console.log('[QueryParser] References period:', referencesPeriod, 'Context dateRange:', context.dateRange)
  
  if (referencesPeriod && context.dateRange) {
    query.dateRange = context.dateRange
    console.log('[QueryParser] Applied context dateRange:', query.dateRange)
    // When referencing "same period", also apply vehicle context if no vehicle specified
    if (!query.vehicleIds || query.vehicleIds.length === 0) {
      if (context.vehicleIds) {
        query.vehicleIds = context.vehicleIds
        console.log('[QueryParser] Applied context vehicleIds (same period):', query.vehicleIds)
      }
    }
  }
  
  // Check if query references "that vehicle", "the same car", etc.
  const vehicleReferences = ['that vehicle', 'the same car', 'same vehicle', 'that car']
  const referencesVehicle = vehicleReferences.some(ref => lowerText.includes(ref))
  
  console.log('[QueryParser] References vehicle:', referencesVehicle, 'Context vehicleIds:', context.vehicleIds)
  
  if (referencesVehicle && context.vehicleIds) {
    query.vehicleIds = context.vehicleIds
    console.log('[QueryParser] Applied context vehicleIds:', query.vehicleIds)
  }
  
  // If no vehicle specified but context has vehicle, use context vehicle
  if ((!query.vehicleIds || query.vehicleIds.length === 0) && context.vehicleIds) {
    query.vehicleIds = context.vehicleIds
    console.log('[QueryParser] Applied context vehicleIds (no vehicle specified):', query.vehicleIds)
  }
  
  console.log('[QueryParser] Final query after merge:', query)
}

/**
 * Detect the type of query from natural language
 * @param {string} text - User's query text
 * @returns {string} Query type: 'cost', 'efficiency', 'comparison', 'maintenance', 'export', 'capabilities', 'general'
 */
export function detectQueryType(text) {
  const lowerText = text.toLowerCase()

  // Capability questions - check these first
  const capabilityKeywords = ['what can you do', 'what can you help', 'your capabilities', 'what are your features', 'what can you offer', 'what do you do', 'help me with', 'what can i ask', 'how can you help']
  if (capabilityKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'capabilities'
  }

  // Cost-related queries
  const costKeywords = ['cost', 'spend', 'spent', 'price', 'expensive', 'cheap', 'budget', 'money', 'fuel cost', 'fuel price']
  if (costKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'cost'
  }

  // Efficiency-related queries
  const efficiencyKeywords = ['efficiency', 'consumption', 'km/l', 'l/100km', 'fuel economy', 'mpg', 'efficient', 'economy', 'mileage', 'milage', 'average', 'km per liter']
  if (efficiencyKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'efficiency'
  }

  // Comparison queries
  const comparisonKeywords = ['compare', 'difference', 'versus', 'vs', 'better', 'worse', 'between', 'which']
  if (comparisonKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'comparison'
  }

  // Maintenance queries
  const maintenanceKeywords = ['maintenance', 'service', 'repair', 'oil change', 'tire', 'brake', 'filter', 'inspection']
  if (maintenanceKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'maintenance'
  }

  // Export queries
  const exportKeywords = ['export', 'download', 'save', 'report', 'excel', 'pdf', 'file']
  if (exportKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'export'
  }

  // Default to general query
  return 'general'
}

/**
 * Extract date range from natural language
 * @param {string} text - User's query text
 * @returns {Object|null} Date range { startDate, endDate } or null
 */
export function extractDateRange(text) {
  const lowerText = text.toLowerCase()
  const now = new Date()

  // Specific month names
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december']
  
  for (let i = 0; i < months.length; i++) {
    if (lowerText.includes(months[i])) {
      // Check if year is specified
      const yearMatch = text.match(/\b(20\d{2})\b/)
      const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear()
      
      const startDate = new Date(year, i, 1)
      const endDate = new Date(year, i + 1, 0)
      
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        label: `${months[i].charAt(0).toUpperCase() + months[i].slice(1)} ${year}`
      }
    }
  }

  // "this month"
  if (lowerText.includes('this month')) {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label: 'This month'
    }
  }

  // "last month"
  if (lowerText.includes('last month')) {
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label: 'Last month'
    }
  }

  // "this year"
  if (lowerText.includes('this year')) {
    const startDate = new Date(now.getFullYear(), 0, 1)
    const endDate = new Date(now.getFullYear(), 11, 31)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label: 'This year'
    }
  }

  // "last year"
  if (lowerText.includes('last year')) {
    const startDate = new Date(now.getFullYear() - 1, 0, 1)
    const endDate = new Date(now.getFullYear() - 1, 11, 31)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label: 'Last year'
    }
  }

  // "last X months" or "past X months"
  const lastMonthsMatch = lowerText.match(/(?:last|past) (\d+) months?/)
  if (lastMonthsMatch) {
    const months = parseInt(lastMonthsMatch[1])
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label: `Last ${months} months`
    }
  }

  // Specific year
  const yearMatch = text.match(/\b(20\d{2})\b/)
  if (yearMatch && !lowerText.includes('month')) {
    const year = parseInt(yearMatch[1])
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      label: `${year}`
    }
  }

  return null
}

/**
 * Get all available vehicle IDs
 * @returns {Array} Array of vehicle IDs
 */
function getAllVehicleIds() {
  try {
    const vehicleData = localStorage.getItem('fueltracker-vehicles-v2')
    console.log('[QueryParser] Vehicle data from localStorage:', vehicleData)
    if (vehicleData) {
      const allVehicles = JSON.parse(vehicleData)
      console.log('[QueryParser] All vehicles parsed:', allVehicles)
      const activeVehicles = allVehicles.filter(v => !v.deletedAt && !v.pendingDelete)
      console.log('[QueryParser] Active vehicles:', activeVehicles)
      const vehicleIds = activeVehicles.map(v => v.id)
      console.log('[QueryParser] Returning vehicle IDs:', vehicleIds)
      return vehicleIds
    }
  } catch (error) {
    console.error('[QueryParser] Error getting all vehicle IDs:', error)
  }
  console.log('[QueryParser] No vehicles found, returning empty array')
  return []
}

/**
 * Extract vehicle references from natural language
 * @param {string} text - User's query text
 * @returns {Array} Array of vehicle IDs or names (will be resolved later)
 */
export function extractVehicles(text) {
  const lowerText = text.toLowerCase()
  const vehicles = []

  // Try to get vehicles from localStorage to match names
  try {
    const vehicleData = localStorage.getItem('fueltracker-vehicles-v2')
    if (vehicleData) {
      const allVehicles = JSON.parse(vehicleData)
      const activeVehicles = allVehicles.filter(v => !v.deletedAt && !v.pendingDelete)
      
      console.log('[QueryParser] Active vehicles:', activeVehicles.map(v => ({ id: v.id, name: v.name, make: v.make, model: v.model })))
      
      // Check for vehicle names in the text
      activeVehicles.forEach(vehicle => {
        if (lowerText.includes(vehicle.name.toLowerCase())) {
          console.log('[QueryParser] Found vehicle by name:', vehicle.name)
          vehicles.push(vehicle.id)
        }
        // Also check make/model combinations
        if (vehicle.make && lowerText.includes(vehicle.make.toLowerCase())) {
          console.log('[QueryParser] Found vehicle by make:', vehicle.make)
          vehicles.push(vehicle.id)
        }
        if (vehicle.model && lowerText.includes(vehicle.model.toLowerCase())) {
          console.log('[QueryParser] Found vehicle by model:', vehicle.model)
          vehicles.push(vehicle.id)
        }
      })
    }
  } catch (error) {
    console.error('[QueryParser] Error reading vehicles:', error)
  }

  // Check for generic vehicle references
  if (lowerText.includes('my car') || lowerText.includes('my vehicle')) {
    // Will be resolved to currently selected vehicle
    vehicles.push('current')
  }

  console.log('[QueryParser] Extracted vehicle IDs:', vehicles)
  
  // Remove duplicates
  return [...new Set(vehicles)]
}

/**
 * Extract metrics from natural language
 * @param {string} text - User's query text
 * @returns {Array} Array of metric names
 */
export function extractMetrics(text) {
  const lowerText = text.toLowerCase()
  const metrics = []

  const metricMap = {
    'fuel cost': 'totalCost',
    'cost': 'totalCost',
    'spending': 'totalCost',
    'spent': 'totalCost',
    'distance': 'totalDistance',
    'kilometers': 'totalDistance',
    'km': 'totalDistance',
    'efficiency': 'avgEfficiency',
    'consumption': 'avgEfficiency',
    'fuel economy': 'avgEfficiency',
    'fill-up': 'fillUpCount',
    'fillups': 'fillUpCount',
    'fill ups': 'fillUpCount',
    'cost per km': 'avgCostPerKm',
    'cost per kilometer': 'avgCostPerKm',
  }

  Object.keys(metricMap).forEach(key => {
    if (lowerText.includes(key)) {
      metrics.push(metricMap[key])
    }
  })

  // If no specific metrics found, return 'all' for comprehensive queries
  if (metrics.length === 0) {
    return ['all']
  }

  return [...new Set(metrics)]
}

/**
 * Extract export format from natural language
 * @param {string} text - User's query text
 * @returns {string|null} Export format: 'excel', 'pdf', or null
 */
export function extractExportFormat(text) {
  const lowerText = text.toLowerCase()

  if (lowerText.includes('excel') || lowerText.includes('xlsx') || lowerText.includes('spreadsheet')) {
    return 'excel'
  }
  if (lowerText.includes('pdf')) {
    return 'pdf'
  }

  return null
}

/**
 * Extract number of fill-ups or data points from query
 * @param {string} text - User's query text
 * @returns {number|null} Number or null
 */
export function extractCount(text) {
  const match = text.match(/(\d+)\s*(fill-up|fillup|fill|entry|record)/i)
  if (match) {
    return parseInt(match[1])
  }
  return null
}
