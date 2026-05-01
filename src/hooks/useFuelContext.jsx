import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { calculateTripMetrics } from '../utils/calculations';
import { formatTo2Decimals } from '../utils/formatting';
import { MAINTENANCE_CATEGORIES } from '../data/maintenanceCategories';

const FuelContext = createContext(null);

export function FuelProvider({ children }) {
  const [vehicles, setVehicles] = useLocalStorage('fueltracker-vehicles-v2', [{ id: 'default', name: 'My Car', type: 'car' }]);
  const [selectedVehicleId, setSelectedVehicleId] = useLocalStorage('fueltracker-active-vehicle-v2', 'default');
  const [fuelPrices, setFuelPrices] = useLocalStorage('fueltracker-prices-v2', { 92: 22.25, 95: 25.00, diesel: 20.50 });
  const [fillUps, setFillUps] = useLocalStorage('fueltracker-fillups-v2', []);
  const [tripEstimates, setTripEstimates] = useLocalStorage('fueltracker-trip-estimates-v2', []);
  const [tyreComparisons, setTyreComparisons] = useLocalStorage('fueltracker-tyre-comparisons-v2', []);
  const [maintenanceLogs, setMaintenanceLogs] = useLocalStorage('fueltracker-maintenance-logs-v2', []);
  const [maintenanceReminders, setMaintenanceReminders] = useLocalStorage('fueltracker-maintenance-reminders-v2', []);
  
  // Maintenance settings with defaults
  const [maintenanceSettings, setMaintenanceSettings] = useLocalStorage('fueltracker-maintenance-settings-v2', {
    defaultSafetyMarginKm: 2000,
    categorySettings: {}
  });

  // Filter for active vehicle - sorted by timestamp for display
  const activeVehicleFillUps = fillUps
    .filter(f => f.vehicleId === selectedVehicleId)
    .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Filter for active vehicle - sorted by odometer for calculations
  const activeVehicleFillUpsByOdometer = fillUps
    .filter(f => f.vehicleId === selectedVehicleId)
    .sort((a,b) => a.odometer - b.odometer);

  const addFillUp = (entry) => {
    setFillUps(prev => [...prev, { ...entry, id: Date.now(), vehicleId: selectedVehicleId }]);
  };

  const deleteFillUp = (id) => {
    setFillUps(prev => prev.filter(f => f.id !== id));
  };

  const deleteMultipleFillUps = (ids) => {
    const idsSet = new Set(ids);
    setFillUps(prev => prev.filter(f => !idsSet.has(f.id)));
  };

  const updateFillUp = (id, updatedData) => {
    setFillUps(prev => prev.map(f => f.id === id ? { ...f, ...updatedData } : f));
  };

  const addVehicle = (vehicle) => {
    const id = `v_${Date.now()}`;
    setVehicles(prev => [...prev, { ...vehicle, id }]);
    setSelectedVehicleId(id);
  };

  const editVehicle = (id, updates) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVehicle = (id) => {
    if (vehicles.length <= 1) return;
    setVehicles(prev => prev.filter(v => v.id !== id));
    setFillUps(prev => prev.filter(f => f.vehicleId !== id));
    setTripEstimates(prev => prev.filter(e => e.vehicleId !== id));
    setTyreComparisons(prev => prev.filter(c => c.vehicleId !== id));
    setMaintenanceLogs(prev => prev.filter(log => log.vehicleId !== id));
    setMaintenanceReminders(prev => prev.filter(reminder => reminder.vehicleId !== id));
    if (selectedVehicleId === id) {
       setSelectedVehicleId(vehicles.find(v => v.id !== id).id);
    }
  };

  const addTripEstimate = (estimate) => {
    setTripEstimates(prev => [...prev, { 
      ...estimate, 
      id: Date.now(), 
      vehicleId: selectedVehicleId,
      timestamp: new Date().toISOString()
    }]);
  };

  const deleteTripEstimate = (id) => {
    setTripEstimates(prev => prev.filter(e => e.id !== id));
  };

  const deleteMultipleTripEstimates = (ids) => {
    const idsSet = new Set(ids);
    setTripEstimates(prev => prev.filter(e => !idsSet.has(e.id)));
  };

  const addTyreComparison = (comparison) => {
    setTyreComparisons(prev => [...prev, {
      ...comparison,
      id: Date.now(),
      vehicleId: selectedVehicleId
    }]);
  };

  const deleteTyreComparison = (id) => {
    setTyreComparisons(prev => prev.filter(c => c.id !== id));
  };

  const addMaintenanceLog = (log) => {
    setMaintenanceLogs(prev => [...prev, {
      ...log,
      id: Date.now(),
      vehicleId: selectedVehicleId,
      timestamp: new Date().toISOString()
    }]);
  };

  const updateMaintenanceLog = (id, updatedData) => {
    setMaintenanceLogs(prev => prev.map(log => log.id === id ? { ...log, ...updatedData } : log));
  };

  const deleteMaintenanceLog = (id) => {
    setMaintenanceLogs(prev => prev.filter(log => log.id !== id));
  };

  const addMaintenanceReminder = (reminder) => {
    // Compute nextDueODO and alertODO
    const safetyMargin = reminder.safetyMarginKm ?? maintenanceSettings.defaultSafetyMarginKm ?? 2000;
    const baseODO = reminder.performedAtOdometer ?? reminder.odometerThreshold ?? 0;
    const interval = reminder.odometerInterval ?? 0;
    
    let nextDueODO = null;
    let alertODO = null;
    
    if (baseODO > 0 && interval > 0) {
      nextDueODO = baseODO + interval;
      alertODO = nextDueODO - safetyMargin;
    }
    
    setMaintenanceReminders(prev => [...prev, {
      ...reminder,
      id: Date.now(),
      vehicleId: selectedVehicleId,
      createdAt: new Date().toISOString(),
      nextDueODO,
      alertODO,
      safetyMarginKm: safetyMargin
    }]);
  };

  const updateMaintenanceReminder = (id, updatedData) => {
    setMaintenanceReminders(prev => prev.map(reminder => {
      if (reminder.id !== id) return reminder;
      
      const updated = { ...reminder, ...updatedData };
      
      // Recalculate computed ODO values if relevant fields changed
      if (updated.odometerThreshold || updated.safetyMarginKm !== undefined || updated.performedAtOdometer) {
        const safetyMargin = updated.safetyMarginKm ?? maintenanceSettings.defaultSafetyMarginKm ?? 2000;
        const baseODO = updated.performedAtOdometer ?? updated.odometerThreshold ?? 0;
        const interval = updated.odometerInterval ?? 0;
        
        if (baseODO > 0 && interval > 0) {
          updated.nextDueODO = baseODO + interval;
          updated.alertODO = updated.nextDueODO - safetyMargin;
        }
      }
      
      return updated;
    }));
  };

  // Helper function to update maintenance settings
  const updateMaintenanceSettings = (updates) => {
    setMaintenanceSettings(prev => ({ ...prev, ...updates }));
  };

  // Update category-specific settings
  const updateCategorySettings = (categoryId, settings) => {
    setMaintenanceSettings(prev => ({
      ...prev,
      categorySettings: {
        ...prev.categorySettings,
        [categoryId]: { ...prev.categorySettings[categoryId], ...settings }
      }
    }));
  };

  const deleteMaintenanceReminder = (id) => {
    setMaintenanceReminders(prev => prev.filter(reminder => reminder.id !== id));
  };

  // Derived Stats - reactive with useMemo
  const stats = useMemo(() => {
    if (activeVehicleFillUpsByOdometer.length === 0) return { totalFillUps: 0, validTripsCount: 0, avgKmPerLiter: 0, avgL100km: 0, totalCost: 0 };
    
    let validTripDistanceSum = 0;
    let validTripLitersSum = 0;
    let totalCost = 0;

    activeVehicleFillUpsByOdometer.forEach((fill, index) => {
      const metrics = calculateTripMetrics(activeVehicleFillUpsByOdometer, index);
      totalCost += metrics.tripCost;
      
      if (index > 0) {
        validTripDistanceSum += metrics.distance;
        validTripLitersSum += fill.liters;
      }
    });

    const validTripsCount = Math.max(0, activeVehicleFillUpsByOdometer.length - 1);
    const avgKmPerLiter = validTripLitersSum > 0 ? formatTo2Decimals(validTripDistanceSum / validTripLitersSum) : 0;
    const avgL100km = validTripDistanceSum > 0 ? formatTo2Decimals((validTripLitersSum / validTripDistanceSum) * 100) : 0;

    return {
      totalFillUps: activeVehicleFillUps.length,
      validTripsCount,
      avgKmPerLiter,
      avgL100km,
      totalCost: formatTo2Decimals(totalCost),
      totalDistance: formatTo2Decimals(validTripDistanceSum),
      totalLiters: formatTo2Decimals(validTripLitersSum + (activeVehicleFillUpsByOdometer.length > 0 && activeVehicleFillUpsByOdometer[0].liters))
    };
  }, [activeVehicleFillUpsByOdometer]);

  // Filter trip estimates for active vehicle
  const activeVehicleTripEstimates = tripEstimates
    .filter(e => e.vehicleId === selectedVehicleId)
    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter tyre comparisons for active vehicle
  const activeVehicleTyreComparisons = tyreComparisons
    .filter(c => c.vehicleId === selectedVehicleId)
    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter maintenance logs for active vehicle
  const activeVehicleMaintenanceLogs = maintenanceLogs
    .filter(log => log.vehicleId === selectedVehicleId)
    .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter maintenance reminders for active vehicle
  const activeVehicleMaintenanceReminders = maintenanceReminders
    .filter(reminder => reminder.vehicleId === selectedVehicleId)
    .sort((a,b) => {
      // Sort by upcoming due date first
      const aDue = new Date(a.nextDueDate || a.dueDate || '9999-12-31').getTime();
      const bDue = new Date(b.nextDueDate || b.dueDate || '9999-12-31').getTime();
      return aDue - bDue;
    });

  const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <FuelContext.Provider value={{
      vehicles, selectedVehicleId, setSelectedVehicleId, fuelPrices, setFuelPrices,
      activeVehicle,
      activeVehicleFillUps, activeVehicleFillUpsByOdometer, addFillUp, deleteFillUp, deleteMultipleFillUps, updateFillUp, addVehicle, editVehicle, deleteVehicle,
      tripEstimates: activeVehicleTripEstimates, addTripEstimate, deleteTripEstimate, deleteMultipleTripEstimates,
      tyreComparisons: activeVehicleTyreComparisons, addTyreComparison, deleteTyreComparison,
      maintenanceLogs: activeVehicleMaintenanceLogs, addMaintenanceLog, updateMaintenanceLog, deleteMaintenanceLog,
      maintenanceReminders: activeVehicleMaintenanceReminders, addMaintenanceReminder, updateMaintenanceReminder, deleteMaintenanceReminder,
      maintenanceSettings, updateMaintenanceSettings, updateCategorySettings,
      stats
    }}>
      {children}
    </FuelContext.Provider>
  );
}

export function useFuel() {
  const context = useContext(FuelContext);
  if (!context) throw new Error("useFuel must be used within FuelProvider");
  return context;
}
