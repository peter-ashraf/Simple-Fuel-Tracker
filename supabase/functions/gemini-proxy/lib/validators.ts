// Request validation utilities

const MAX_REQUEST_SIZE = 100 * 1024 // 100KB max request size

export function validateRequestSize(req: Request): { valid: boolean; message?: string } {
  const contentLength = req.headers.get('content-length')
  
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    return {
      valid: false,
      message: `Request size exceeds ${MAX_REQUEST_SIZE / 1024}KB limit`
    }
  }
  
  return { valid: true }
}

export function validateStatsData(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Stats data must be an object' }
  }

  // Validate required numeric fields
  const numericFields = [
    'totalDistance',
    'totalCost',
    'avgKmPerLiter',
    'avgL100km',
    'fillUpCount',
    'costPerKm'
  ]

  for (const field of numericFields) {
    if (data[field] !== undefined && (typeof data[field] !== 'number' || isNaN(data[field]))) {
      return { valid: false, message: `${field} must be a valid number` }
    }
  }

  // Validate arrays
  if (data.monthlySpending && !Array.isArray(data.monthlySpending)) {
    return { valid: false, message: 'monthlySpending must be an array' }
  }

  if (data.efficiencyTrend && !Array.isArray(data.efficiencyTrend)) {
    return { valid: false, message: 'efficiencyTrend must be an array' }
  }

  return { valid: true }
}

export function validateMonthlyStatsData(data: any): { valid: boolean; message?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: 'Monthly stats must be an object' }
  }

  const numericFields = [
    'totalDistance',
    'totalFuelCost',
    'avgEfficiency',
    'fillUpCount',
    'costPerKm',
    'bestEfficiency',
    'worstEfficiency',
    'drivingDays',
    'avgDailyDistance'
  ]

  for (const field of numericFields) {
    if (data[field] !== undefined && (typeof data[field] !== 'number' || isNaN(data[field]))) {
      return { valid: false, message: `${field} must be a valid number` }
    }
  }

  if (data.monthlySpending && !Array.isArray(data.monthlySpending)) {
    return { valid: false, message: 'monthlySpending must be an array' }
  }

  if (data.efficiencyTrend && !Array.isArray(data.efficiencyTrend)) {
    return { valid: false, message: 'efficiencyTrend must be an array' }
  }

  return { valid: true }
}
