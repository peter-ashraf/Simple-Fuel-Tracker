// Data Access Service - Universal access to all user data across vehicles
// This service provides unified access to fill-ups, maintenance, and trip data for AI queries

/**
 * Get all data from localStorage for a specific key
 */
const getLocalStorageData = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`[DataAccessService] Error reading ${key}:`, error);
    return [];
  }
};

/**
 * Filter out deleted/pending delete records
 */
const filterActiveRecords = (records) => {
  return records.filter(r => 
    !r.deletedAt && 
    !r.pendingDelete && 
    r.lastAction !== 'DELETE'
  );
};

/**
 * Get all vehicles with their associated data
 */
export const getAllVehiclesData = () => {
  const vehicles = getLocalStorageData('fueltracker-vehicles-v2');
  const fillUps = getLocalStorageData('fueltracker-fillups-v2');
  const maintenanceLogs = getLocalStorageData('fueltracker-maintenance-logs-v2');
  const maintenanceEntries = getLocalStorageData('fueltracker-maintenance-entries-v3');
  const tripEstimates = getLocalStorageData('fueltracker-trip-estimates-v2');
  const tyreComparisons = getLocalStorageData('fueltracker-tyre-comparisons-v2');

  const activeVehicles = filterActiveRecords(vehicles);
  const activeFillUps = filterActiveRecords(fillUps);
  const activeMaintenanceLogs = filterActiveRecords(maintenanceLogs);
  const activeMaintenanceEntries = filterActiveRecords(maintenanceEntries);
  const activeTripEstimates = filterActiveRecords(tripEstimates);
  const activeTyreComparisons = filterActiveRecords(tyreComparisons);

  return activeVehicles.map(vehicle => ({
    ...vehicle,
    fillUps: activeFillUps.filter(f => f.vehicleId === vehicle.id),
    maintenanceLogs: activeMaintenanceLogs.filter(m => m.vehicleId === vehicle.id),
    maintenanceEntries: activeMaintenanceEntries.filter(m => m.vehicleId === vehicle.id),
    tripEstimates: activeTripEstimates.filter(t => t.vehicleId === vehicle.id),
    tyreComparisons: activeTyreComparisons.filter(t => t.vehicleId === vehicle.id),
  }));
};

/**
 * Get data for a specific vehicle
 */
export const getVehicleData = (vehicleId) => {
  const allData = getAllVehiclesData();
  return allData.find(v => v.id === vehicleId) || null;
};

/**
 * Query fill-ups with filters
 */
export const queryFillUps = (filters = {}) => {
  const fillUps = getLocalStorageData('fueltracker-fillups-v2');
  const activeFillUps = filterActiveRecords(fillUps);

  let result = activeFillUps;

  // Filter by vehicle IDs
  if (filters.vehicleIds && filters.vehicleIds.length > 0) {
    const vehicleIdSet = new Set(filters.vehicleIds);
    result = result.filter(f => vehicleIdSet.has(f.vehicleId));
  }

  // Filter by date range
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    result = result.filter(f => new Date(f.timestamp).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    result = result.filter(f => new Date(f.timestamp).getTime() <= end);
  }

  // Filter by odometer range
  if (filters.minOdometer !== undefined) {
    result = result.filter(f => f.odometer >= filters.minOdometer);
  }
  if (filters.maxOdometer !== undefined) {
    result = result.filter(f => f.odometer <= filters.maxOdometer);
  }

  // Sort by timestamp
  result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return result;
};

/**
 * Query maintenance entries with filters
 */
export const queryMaintenance = (filters = {}) => {
  const maintenanceEntries = getLocalStorageData('fueltracker-maintenance-entries-v3');
  const activeEntries = filterActiveRecords(maintenanceEntries);

  let result = activeEntries;

  // Filter by vehicle IDs
  if (filters.vehicleIds && filters.vehicleIds.length > 0) {
    const vehicleIdSet = new Set(filters.vehicleIds);
    result = result.filter(m => vehicleIdSet.has(m.vehicleId));
  }

  // Filter by category/type
  if (filters.types && filters.types.length > 0) {
    const typeSet = new Set(filters.types);
    result = result.filter(m => typeSet.has(m.type));
  }

  // Filter by date range
  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    result = result.filter(m => new Date(m.date || m.timestamp).getTime() >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    result = result.filter(m => new Date(m.date || m.timestamp).getTime() <= end);
  }

  // Filter by odometer range
  if (filters.minOdometer !== undefined) {
    result = result.filter(m => (m.odometer || m.performedAtODO) >= filters.minOdometer);
  }
  if (filters.maxOdometer !== undefined) {
    result = result.filter(m => (m.odometer || m.performedAtODO) <= filters.maxOdometer);
  }

  // Sort by date
  result.sort((a, b) => new Date(a.date || a.timestamp).getTime() - new Date(b.date || b.timestamp).getTime());

  return result;
};

/**
 * Compare vehicles on specific metrics
 */
export const compareVehicles = (vehicleIds, metrics = [], period = null) => {
  const vehicles = getLocalStorageData('fueltracker-vehicles-v2');
  const activeVehicles = filterActiveRecords(vehicles);
  const targetVehicles = activeVehicles.filter(v => vehicleIds.includes(v.id));

  if (targetVehicles.length === 0) return [];

  const fillUps = getLocalStorageData('fueltracker-fillups-v2');
  const activeFillUps = filterActiveRecords(fillUps);

  // Apply date period filter if specified
  let filteredFillUps = activeFillUps;
  if (period) {
    const { startDate, endDate } = period;
    if (startDate) {
      const start = new Date(startDate).getTime();
      filteredFillUps = filteredFillUps.filter(f => new Date(f.timestamp).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      filteredFillUps = filteredFillUps.filter(f => new Date(f.timestamp).getTime() <= end);
    }
  }

  return targetVehicles.map(vehicle => {
    const vehicleFillUps = filteredFillUps
      .filter(f => f.vehicleId === vehicle.id)
      .sort((a, b) => a.odometer - b.odometer);

    const comparison = {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
    };

    // Calculate requested metrics
    if (metrics.includes('totalDistance') || metrics.includes('all')) {
      const totalDistance = vehicleFillUps.length > 1
        ? vehicleFillUps[vehicleFillUps.length - 1].odometer - vehicleFillUps[0].odometer
        : 0;
      comparison.totalDistance = totalDistance;
    }

    if (metrics.includes('totalCost') || metrics.includes('all')) {
      const totalCost = vehicleFillUps.reduce((sum, f, idx) => {
        if (idx === 0) return sum;
        return sum + (f.liters * (f.pricePerLiter || 0));
      }, 0);
      comparison.totalCost = totalCost;
    }

    if (metrics.includes('avgEfficiency') || metrics.includes('all')) {
      let totalDistance = 0;
      let totalLiters = 0;
      for (let i = 1; i < vehicleFillUps.length; i++) {
        const distance = vehicleFillUps[i].odometer - vehicleFillUps[i - 1].odometer;
        totalDistance += distance;
        totalLiters += vehicleFillUps[i].liters;
      }
      comparison.avgEfficiency = totalLiters > 0 ? totalDistance / totalLiters : 0;
    }

    if (metrics.includes('fillUpCount') || metrics.includes('all')) {
      comparison.fillUpCount = vehicleFillUps.length;
    }

    if (metrics.includes('avgCostPerKm') || metrics.includes('all')) {
      const totalCost = vehicleFillUps.reduce((sum, f, idx) => {
        if (idx === 0) return sum;
        return sum + (f.liters * (f.pricePerLiter || 0));
      }, 0);
      const totalDistance = vehicleFillUps.length > 1
        ? vehicleFillUps[vehicleFillUps.length - 1].odometer - vehicleFillUps[0].odometer
        : 0;
      comparison.avgCostPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;
    }

    return comparison;
  });
};

/**
 * Calculate aggregates from data
 */
export const calculateAggregates = (data, metric) => {
  if (!data || data.length === 0) return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };

  const values = data.map(item => {
    if (typeof metric === 'function') {
      return metric(item);
    }
    return item[metric];
  }).filter(v => v !== null && v !== undefined && !isNaN(v));

  if (values.length === 0) {
    return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    sum,
    avg,
    min,
    max,
    count: values.length,
  };
};

/**
 * Get monthly aggregates for fill-ups
 */
export const getMonthlyAggregates = (vehicleIds = null, metric = 'cost') => {
  const fillUps = queryFillUps(vehicleIds ? { vehicleIds } : {});
  
  const monthlyData = {};
  
  fillUps.forEach(f => {
    const date = new Date(f.timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[key]) {
      monthlyData[key] = {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        fillUps: [],
      };
    }
    
    monthlyData[key].fillUps.push(f);
  });

  return Object.values(monthlyData).map(month => {
    const values = month.fillUps.map(f => {
      if (metric === 'cost') return f.liters * (f.pricePerLiter || 0);
      if (metric === 'liters') return f.liters;
      if (metric === 'distance') {
        // Need to calculate distance between fill-ups
        return 0; // Simplified for now
      }
      return f[metric] || 0;
    });

    return {
      year: month.year,
      month: month.month,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      count: values.length,
    };
  }).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
};
