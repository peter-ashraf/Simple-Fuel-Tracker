// Query Executor - Execute structured queries against data
// This module takes parsed queries and executes them using the data access service

import { 
  queryFillUps, 
  queryMaintenance, 
  compareVehicles, 
  calculateAggregates,
  getMonthlyAggregates 
} from './dataAccessService'

/**
 * Execute a structured query and return results
 * @param {Object} query - Parsed query object from queryParser
 * @returns {Object} Query results with metadata
 */
export function executeQuery(query) {
  const { type, dateRange, vehicleIds, metrics, filters } = query

  // Resolve 'current' vehicle ID if present
  const resolvedVehicleIds = resolveVehicleIds(vehicleIds)

  const results = {
    queryType: type,
    originalText: query.originalText,
    dateRange: dateRange,
    vehicleIds: resolvedVehicleIds,
    data: null,
    metadata: {
      rowCount: 0,
      executionTime: Date.now(),
    },
  }

  try {
    switch (type) {
      case 'capabilities':
        results.data = executeCapabilitiesQuery()
        break
      case 'cost':
        results.data = executeCostQuery(resolvedVehicleIds, dateRange, metrics)
        break
      case 'efficiency':
        results.data = executeEfficiencyQuery(resolvedVehicleIds, dateRange, metrics)
        break
      case 'comparison':
        results.data = executeComparisonQuery(resolvedVehicleIds, metrics, dateRange)
        break
      case 'maintenance':
        results.data = executeMaintenanceQuery(resolvedVehicleIds, dateRange, filters)
        break
      case 'export':
        results.data = executeExportQuery(resolvedVehicleIds, dateRange, metrics)
        break
      default:
        results.data = executeGeneralQuery(resolvedVehicleIds, dateRange, metrics)
    }

    results.metadata.rowCount = Array.isArray(results.data) ? results.data.length : 1
    results.metadata.executionTime = Date.now() - results.metadata.executionTime
    results.success = true
  } catch (error) {
    console.error('[QueryExecutor] Error executing query:', error)
    results.success = false
    results.error = error.message
  }

  return results
}

/**
 * Execute cost-related query
 */
function executeCostQuery(vehicleIds, dateRange, metrics) {
  const fillUps = queryFillUps({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
  })

  const totalCost = fillUps.reduce((sum, f) => sum + (f.liters * (f.pricePerLiter || 0)), 0)
  const totalLiters = fillUps.reduce((sum, f) => sum + f.liters, 0)

  // Calculate monthly breakdown
  const monthlyData = getMonthlyAggregates(vehicleIds, 'cost').filter(m => {
    if (!dateRange) return true
    const monthDate = new Date(m.year, m.month - 1)
    const start = new Date(dateRange.startDate)
    const end = new Date(dateRange.endDate)
    return monthDate >= start && monthDate <= end
  })

  return {
    totalCost,
    totalLiters,
    avgCostPerFill: fillUps.length > 0 ? totalCost / fillUps.length : 0,
    fillUpCount: fillUps.length,
    monthlyBreakdown: monthlyData,
    currency: 'currency', // Will be replaced with actual currency from settings
  }
}

/**
 * Execute efficiency-related query
 */
function executeEfficiencyQuery(vehicleIds, dateRange, metrics) {
  const fillUps = queryFillUps({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
  })

  // Sort by odometer for efficiency calculation
  const sortedByOdometer = [...fillUps].sort((a, b) => a.odometer - b.odometer)

  let totalDistance = 0
  let totalLiters = 0
  const efficiencyValues = []

  for (let i = 1; i < sortedByOdometer.length; i++) {
    const prev = sortedByOdometer[i - 1]
    const curr = sortedByOdometer[i]
    const distance = curr.odometer - prev.odometer
    const kmPerLiter = distance > 0 && curr.liters > 0 ? distance / curr.liters : 0

    totalDistance += distance
    totalLiters += curr.liters
    if (kmPerLiter > 0) efficiencyValues.push(kmPerLiter)
  }

  const avgEfficiency = totalLiters > 0 ? totalDistance / totalLiters : 0
  const l100km = totalDistance > 0 ? (totalLiters / totalDistance) * 100 : 0

  const aggregates = calculateAggregates(efficiencyValues, v => v)

  return {
    avgEfficiency,
    avgL100km: l100km,
    bestEfficiency: aggregates.max,
    worstEfficiency: aggregates.min,
    totalDistance,
    totalLiters,
    dataPoints: efficiencyValues.length,
    fillUpCount: fillUps.length,
  }
}

/**
 * Execute capabilities query - return what the AI can do
 */
function executeCapabilitiesQuery() {
  return {
    capabilities: [
      {
        category: 'Fuel Cost Analysis',
        features: [
          'Show fuel costs for specific time periods (e.g., "Show me fuel costs for January")',
          'Calculate average cost per fill-up',
          'Track total fuel spending over time',
          'Analyze monthly fuel cost trends',
        ]
      },
      {
        category: 'Fuel Efficiency',
        features: [
          'Calculate fuel efficiency (km/L or L/100km)',
          'Track efficiency trends over time',
          'Compare efficiency between vehicles',
          'Identify best and worst fuel efficiency periods',
        ]
      },
      {
        category: 'Vehicle Comparison',
        features: [
          'Compare multiple vehicles side by side',
          'Analyze cost differences between vehicles',
          'Compare efficiency metrics across vehicles',
          'Identify which vehicle is more cost-effective',
        ]
      },
      {
        category: 'Maintenance Tracking',
        features: [
          'View maintenance history',
          'Track maintenance costs',
          'Analyze maintenance patterns',
          'Get maintenance reminders',
        ]
      },
      {
        category: 'Data Export',
        features: [
          'Export data to Excel',
          'Export data to PDF',
          'Generate reports',
          'Download fuel history',
        ]
      },
      {
        category: 'General Insights',
        features: [
          'Get overall fuel spending summary',
          'View total distance traveled',
          'Track fill-up count',
          'Analyze driving patterns',
        ]
      }
    ],
    examples: [
      'Show me fuel costs for January',
      'Compare my vehicles',
      'What\'s my fuel efficiency?',
      'Export my data to Excel',
      'Show maintenance history',
      'How much did I spend on fuel last month?',
    ]
  }
}

/**
 * Execute comparison query between vehicles
 */
function executeComparisonQuery(vehicleIds, metrics, dateRange) {
  console.log('[QueryExecutor] executeComparisonQuery called with:', { vehicleIds, metrics, dateRange })
  
  if (!vehicleIds || vehicleIds.length < 2) {
    console.log('[QueryExecutor] Not enough vehicles for comparison:', vehicleIds)
    return { error: 'Comparison requires at least 2 vehicles' }
  }

  const comparison = compareVehicles(vehicleIds, metrics || ['all'], dateRange)
  console.log('[QueryExecutor] Comparison result:', comparison)

  return {
    vehicles: comparison,
    metrics: metrics || ['all'],
    period: dateRange ? `${dateRange.startDate} to ${dateRange.endDate}` : 'all time',
  }
}

/**
 * Execute maintenance-related query
 */
function executeMaintenanceQuery(vehicleIds, dateRange, filters) {
  const maintenanceEntries = queryMaintenance({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
    types: filters?.types,
  })

  // Group by category
  const byCategory = {}
  maintenanceEntries.forEach(entry => {
    if (!byCategory[entry.type]) {
      byCategory[entry.type] = []
    }
    byCategory[entry.type].push(entry)
  })

  // Calculate totals
  const totalCost = maintenanceEntries.reduce((sum, e) => sum + (e.cost || 0), 0)

  return {
    totalEntries: maintenanceEntries.length,
    totalCost,
    byCategory: Object.keys(byCategory).map(category => ({
      category,
      count: byCategory[category].length,
      entries: byCategory[category],
    })),
  }
}

/**
 * Execute export query - prepare data for export
 */
function executeExportQuery(vehicleIds, dateRange, metrics) {
  const fillUps = queryFillUps({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
  })

  const maintenance = queryMaintenance({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
  })

  return {
    fillUps: fillUps.map(f => ({
      date: new Date(f.timestamp).toLocaleDateString(),
      odometer: f.odometer,
      liters: f.liters,
      pricePerLiter: f.pricePerLiter,
      totalCost: f.liters * (f.pricePerLiter || 0),
    })),
    maintenance: maintenance.map(m => ({
      date: new Date(m.date || m.timestamp).toLocaleDateString(),
      type: m.type,
      odometer: m.odometer || m.performedAtODO,
      cost: m.cost,
    })),
    summary: {
      fillUpCount: fillUps.length,
      maintenanceCount: maintenance.length,
      dateRange: dateRange ? `${dateRange.startDate} to ${dateRange.endDate}` : 'all time',
    },
  }
}

/**
 * Execute general query - return summary data
 */
function executeGeneralQuery(vehicleIds, dateRange, metrics) {
  const fillUps = queryFillUps({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
  })

  const maintenance = queryMaintenance({
    vehicleIds,
    startDate: dateRange?.startDate,
    endDate: dateRange?.endDate,
  })

  const totalCost = fillUps.reduce((sum, f) => sum + (f.liters * (f.pricePerLiter || 0)), 0)
  
  let totalDistance = 0;
  const sortedFillUps = [...fillUps].sort((a, b) => a.odometer - b.odometer);
  for (let i = 1; i < sortedFillUps.length; i++) {
    totalDistance += Math.max(0, sortedFillUps[i].odometer - sortedFillUps[i - 1].odometer);
  }

  return {
    fillUpCount: fillUps.length,
    maintenanceCount: maintenance.length,
    totalCost,
    totalDistance,
    dateRange: dateRange ? `${dateRange.startDate} to ${dateRange.endDate}` : 'all time',
  }
}

/**
 * Resolve vehicle IDs, replacing 'current' with actual selected vehicle ID
 */
function resolveVehicleIds(vehicleIds) {
  if (!vehicleIds || vehicleIds.length === 0) return null

  // If 'current' is in the list, replace with actual selected vehicle
  if (vehicleIds.includes('current')) {
    try {
      const selectedId = localStorage.getItem('fueltracker-selected-vehicle-id')
      if (selectedId) {
        return vehicleIds.map(id => id === 'current' ? selectedId : id)
      }
    } catch (error) {
      console.error('[QueryExecutor] Error resolving current vehicle:', error)
    }
  }

  return vehicleIds
}

/**
 * Execute time series query for trends over time
 */
export function executeTimeSeriesQuery(query) {
  const { vehicleIds, dateRange, metrics } = query
  const resolvedVehicleIds = resolveVehicleIds(vehicleIds)

  const monthlyData = getMonthlyAggregates(resolvedVehicleIds, 'cost').filter(m => {
    if (!dateRange) return true
    const monthDate = new Date(m.year, m.month - 1)
    const start = new Date(dateRange.startDate)
    const end = new Date(dateRange.endDate)
    return monthDate >= start && monthDate <= end
  })

  return {
    timeSeries: monthlyData.map(m => ({
      period: `${m.year}-${String(m.month).padStart(2, '0')}`,
      value: m.sum,
      count: m.count,
      average: m.avg,
    })),
    metadata: {
      dataPoints: monthlyData.length,
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    },
  }
}
