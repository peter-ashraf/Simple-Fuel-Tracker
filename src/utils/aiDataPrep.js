// AI data preparation utility
// This utility ONLY prepares already-calculated statistics for AI interpretation
// It does NOT perform any business calculations - those are done by the application

import { format } from 'date-fns'
import { getAllVehiclesData, getVehicleData, compareVehicles } from '../services/dataAccessService'

/**
 * Prepare dashboard insights data for AI
 * Uses only pre-calculated statistics from the application
 * @param {Object} stats - Pre-calculated statistics from useFuel context
 * @param {Array} activeVehicleFillUps - Fill-up data for trend calculation
 * @param {string} vehicleName - Vehicle name for context
 * @param {string} currency - Currency symbol
 * @returns {Object} Structured data ready for AI interpretation
 */
export function prepareInsightsData(stats, activeVehicleFillUps, vehicleName = 'Vehicle', currency = 'currency') {
  // Calculate monthly spending from existing fill-ups
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ 
      year: d.getFullYear(), 
      month: d.getMonth(), 
      total: 0,
      label: format(d, 'MMM')
    })
  }
  
  activeVehicleFillUps.forEach(f => {
    const fd = new Date(f.timestamp)
    const match = months.find(m => m.year === fd.getFullYear() && m.month === fd.getMonth())
    if (match) match.total += f.liters * (f.pricePerLiter || 0)
  })

  // Calculate efficiency trend from existing fill-ups
  const efficiencyTrend = []
  for (let i = 1; i < activeVehicleFillUps.length; i++) {
    const prev = activeVehicleFillUps[i - 1]
    const curr = activeVehicleFillUps[i]
    const distance = curr.odometer - prev.odometer
    const kmPerLiter = distance > 0 && curr.liters > 0 ? distance / curr.liters : 0
    if (kmPerLiter > 0) efficiencyTrend.push({ index: i, value: kmPerLiter })
  }

  // Return structured data using ONLY pre-calculated statistics
  return {
    vehicleName,
    currency,
    totalDistance: stats.totalDistance || 0,
    totalCost: stats.totalCost || 0,
    avgKmPerLiter: stats.avgKmPerLiter || 0,
    avgL100km: stats.avgL100km || 0,
    fillUpCount: activeVehicleFillUps.length,
    dateRange: {
      start: activeVehicleFillUps[0]?.timestamp || new Date().toISOString(),
      end: activeVehicleFillUps[activeVehicleFillUps.length - 1]?.timestamp || new Date().toISOString(),
    },
    monthlySpending: months.map(m => ({ month: m.label, total: m.total })),
    efficiencyTrend: efficiencyTrend.slice(-10),
    costPerKm: stats.totalDistance > 0 ? stats.totalCost / stats.totalDistance : 0,
  }
}

/**
 * Prepare monthly report data for AI
 * Uses only pre-calculated statistics from the application
 * @param {Object} stats - Pre-calculated statistics from useFuel context
 * @param {Array} activeVehicleFillUps - Fill-up data for extended calculations
 * @param {string} vehicleName - Vehicle name for report
 * @param {string} currency - Currency symbol
 * @returns {Object} Structured data ready for AI interpretation
 */
export function prepareMonthlyReportData(stats, activeVehicleFillUps, vehicleName = 'Vehicle', currency = 'currency') {
  if (activeVehicleFillUps.length === 0) {
    const now = new Date();
    return {
      vehicleName: vehicleName || 'Vehicle',
      currency,
      period: format(now, 'MMMM yyyy'),
      totalDistance: 0,
      totalFuelCost: 0,
      avgEfficiency: 0,
      fillUpCount: 0,
      bestEfficiency: 0,
      worstEfficiency: 0,
      totalSpent: 0,
      costPerKm: 0,
      drivingDays: 0,
      avgDailyDistance: 0,
      monthlySpending: [],
      efficiencyTrend: [],
    }
  }

  const sortedFillUps = [...activeVehicleFillUps].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const latestFill = sortedFillUps[sortedFillUps.length - 1]
  const targetDate = new Date(latestFill.timestamp)
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth()

  const monthFillUps = sortedFillUps.filter((f) => {
    const fd = new Date(f.timestamp)
    return fd.getFullYear() === targetYear && fd.getMonth() === targetMonth
  })

  const monthDrivingDays = new Set(
    monthFillUps.map((f) => new Date(f.timestamp).toDateString()),
  ).size

  const monthlyFuelCost = monthFillUps.reduce(
    (sum, fill) => sum + fill.liters * (fill.pricePerLiter || 0),
    0,
  )

  const monthlyLiters = monthFillUps.reduce((sum, fill) => sum + fill.liters, 0)
  const monthlyDistance = monthFillUps.length > 1
    ? monthFillUps[monthFillUps.length - 1].odometer - monthFillUps[0].odometer
    : 0

  const monthlyEfficiencyValues = []
  for (let i = 1; i < monthFillUps.length; i++) {
    const prev = monthFillUps[i - 1]
    const curr = monthFillUps[i]
    const distance = curr.odometer - prev.odometer
    const kmPerLiter = distance > 0 && curr.liters > 0 ? distance / curr.liters : 0
    if (kmPerLiter > 0) {
      monthlyEfficiencyValues.push(kmPerLiter)
    }
  }

  const bestEfficiency = monthlyEfficiencyValues.length > 0 ? Math.max(...monthlyEfficiencyValues) : 0
  const worstEfficiency = monthlyEfficiencyValues.length > 0 ? Math.min(...monthlyEfficiencyValues) : 0
  const avgEfficiency = monthlyDistance > 0 && monthlyLiters > 0 ? monthlyDistance / monthlyLiters : 0
  const costPerKm = monthlyDistance > 0 ? monthlyFuelCost / monthlyDistance : 0
  const avgDailyDistance = monthDrivingDays > 0 ? monthlyDistance / monthDrivingDays : 0

  const now = new Date()
  const monthlySpending = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    let total = 0
    activeVehicleFillUps.forEach((f) => {
      const fd = new Date(f.timestamp)
      if (fd.getFullYear() === d.getFullYear() && fd.getMonth() === d.getMonth()) {
        total += f.liters * (f.pricePerLiter || 0)
      }
    })
    monthlySpending.push({
      month: format(d, 'MMM'),
      total,
    })
  }

  const efficiencyTrend = []
  for (let i = 1; i < monthFillUps.length; i++) {
    const prev = monthFillUps[i - 1]
    const curr = monthFillUps[i]
    const distance = curr.odometer - prev.odometer
    const kmPerLiter = distance > 0 && curr.liters > 0 ? distance / curr.liters : 0
    if (kmPerLiter > 0) {
      efficiencyTrend.push({
        date: curr.timestamp,
        value: kmPerLiter,
      })
    }
  }

  return {
    vehicleName: vehicleName || 'Vehicle',
    currency,
    period: format(targetDate, 'MMMM yyyy'),
    totalDistance: monthlyDistance,
    totalFuelCost: monthlyFuelCost,
    avgEfficiency,
    fillUpCount: monthFillUps.length,
    bestEfficiency,
    worstEfficiency,
    totalSpent: monthlyFuelCost,
    costPerKm,
    drivingDays: monthDrivingDays,
    avgDailyDistance,
    monthlySpending,
    efficiencyTrend,
  }
}

/**
 * Prepare full dataset for AI context
 * Returns all vehicles data in a structured format
 * @returns {Object} Complete dataset with all vehicles and their data
 */
export function prepareFullDataset() {
  const allVehiclesData = getAllVehiclesData()

  return {
    vehicles: allVehiclesData.map(v => ({
      id: v.id,
      name: v.name,
      make: v.make,
      model: v.model,
      year: v.year,
      fillUpCount: v.fillUps.length,
      maintenanceEntryCount: v.maintenanceEntries.length,
      totalDistance: v.fillUps.length > 1 
        ? v.fillUps[v.fillUps.length - 1].odometer - v.fillUps[0].odometer 
        : 0,
    })),
    totalVehicles: allVehiclesData.length,
    totalFillUps: allVehiclesData.reduce((sum, v) => sum + v.fillUps.length, 0),
    totalMaintenanceEntries: allVehiclesData.reduce((sum, v) => sum + v.maintenanceEntries.length, 0),
  }
}

/**
 * Prepare query context based on query type
 * Returns relevant data subset for efficient AI processing
 * @param {Object} query - Parsed query object
 * @returns {Object} Context data relevant to the query
 */
export function prepareQueryContext(query) {
  const { type, vehicleIds, dateRange } = query

  // If specific vehicles requested, get only those
  if (vehicleIds && vehicleIds.length > 0) {
    const vehicles = vehicleIds.map(id => getVehicleData(id)).filter(Boolean)
    return {
      vehicles: vehicles.map(v => ({
        id: v.id,
        name: v.name,
        fillUps: v.fillUps,
        maintenanceEntries: v.maintenanceEntries,
      })),
      queryType: type,
      vehicleIds,
    }
  }

  // If date range specified, filter all data
  if (dateRange) {
    const allData = getAllVehiclesData()
    const { startDate, endDate } = dateRange

    return {
      vehicles: allData.map(v => ({
        id: v.id,
        name: v.name,
        fillUps: v.fillUps.filter(f => {
          const date = new Date(f.timestamp)
          if (startDate && date < new Date(startDate)) return false
          if (endDate && date > new Date(endDate)) return false
          return true
        }),
        maintenanceEntries: v.maintenanceEntries.filter(m => {
          const date = new Date(m.date || m.timestamp)
          if (startDate && date < new Date(startDate)) return false
          if (endDate && date > new Date(endDate)) return false
          return true
        }),
      })),
      queryType: type,
      dateRange,
    }
  }

  // Default: return summary of all vehicles
  return prepareFullDataset()
}

/**
 * Prepare comparison data for vehicle comparisons
 * @param {Array} vehicleIds - IDs of vehicles to compare
 * @param {Array} metrics - Metrics to compare (e.g., ['totalDistance', 'totalCost'])
 * @param {Object} period - Optional date period { startDate, endDate }
 * @returns {Object} Comparison data ready for AI
 */
export function prepareComparisonData(vehicleIds, metrics = ['all'], period = null) {
  const comparison = compareVehicles(vehicleIds, metrics, period)

  return {
    vehicles: comparison,
    metrics,
    period: period ? `${period.startDate} to ${period.endDate}` : 'all time',
    comparisonCount: comparison.length,
  }
}

/**
 * Prepare predictive data for predictions
 * @param {string} vehicleId - Vehicle ID to prepare data for
 * @param {number} horizon - Prediction horizon in months
 * @returns {Object} Historical data for prediction model
 */
export function preparePredictiveData(vehicleId, horizon = 6) {
  const vehicle = getVehicleData(vehicleId)
  if (!vehicle) {
    return { error: 'Vehicle not found', vehicleId }
  }

  const fillUps = vehicle.fillUps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const maintenanceEntries = vehicle.maintenanceEntries.sort((a, b) => new Date(a.date || a.timestamp) - new Date(b.date || b.timestamp))

  // Calculate monthly aggregates for historical patterns
  const monthlyData = {}
  fillUps.forEach(f => {
    const date = new Date(f.timestamp)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!monthlyData[key]) {
      monthlyData[key] = {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        totalCost: 0,
        totalLiters: 0,
        totalDistance: 0,
        fillUpCount: 0,
      }
    }
    
    monthlyData[key].totalCost += f.liters * (f.pricePerLiter || 0)
    monthlyData[key].totalLiters += f.liters
    monthlyData[key].fillUpCount += 1
  })

  // Calculate distance between fill-ups for monthly distance
  const sortedByOdometer = [...fillUps].sort((a, b) => a.odometer - b.odometer)
  for (let i = 1; i < sortedByOdometer.length; i++) {
    const prev = sortedByOdometer[i - 1]
    const curr = sortedByOdometer[i]
    const date = new Date(curr.timestamp)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (monthlyData[key]) {
      monthlyData[key].totalDistance += curr.odometer - prev.odometer
    }
  }

  const monthlyHistory = Object.values(monthlyData).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  // Calculate maintenance patterns
  const maintenanceByCategory = {}
  maintenanceEntries.forEach(m => {
    if (!maintenanceByCategory[m.type]) {
      maintenanceByCategory[m.type] = []
    }
    maintenanceByCategory[m.type].push({
      odometer: m.odometer || m.performedAtODO,
      date: m.date || m.timestamp,
      interval: m.intervalKm || m.distance,
    })
  })

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    horizon,
    monthlyHistory: monthlyHistory.slice(-12), // Last 12 months
    currentOdometer: fillUps.length > 0 ? fillUps[fillUps.length - 1].odometer : 0,
    avgMonthlyCost: monthlyHistory.length > 0 
      ? monthlyHistory.reduce((sum, m) => sum + m.totalCost, 0) / monthlyHistory.length 
      : 0,
    avgMonthlyDistance: monthlyHistory.length > 0
      ? monthlyHistory.reduce((sum, m) => sum + m.totalDistance, 0) / monthlyHistory.length
      : 0,
    avgMonthlyLiters: monthlyHistory.length > 0
      ? monthlyHistory.reduce((sum, m) => sum + m.totalLiters, 0) / monthlyHistory.length
      : 0,
    maintenancePatterns: maintenanceByCategory,
    dataPoints: fillUps.length,
  }
}
