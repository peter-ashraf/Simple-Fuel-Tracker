import { useMemo } from 'react';
import { useLocalStorage } from '../useLocalStorage';
import { calculateTripMetrics } from '../../utils/calculations';
import { formatTo2Decimals } from '../../utils/formatting';
import { cloudSyncService } from '../../services/cloudSyncService';
import { v4 as uuidv4 } from 'uuid';

export function useFuelTrackingState(selectedVehicleId) {
  const [fuelPrices, setFuelPrices] = useLocalStorage('fueltracker-prices-v2', { 92: 22.25, 95: 25.00, diesel: 20.50 });
  const [fillUps, setFillUps] = useLocalStorage('fueltracker-fillups-v2', []);

  // --- APP-WIDE FILTERING ---
  // Any record with deletedAt or lastAction 'DELETE' is considered non-existent for the UI
  const activeFillUps = useMemo(() => 
    fillUps.filter(f => !f.deletedAt && f.lastAction !== 'DELETE'),
    [fillUps]
  );

  // Filter for active vehicle - sorted by timestamp for display
  const activeVehicleFillUps = useMemo(() => 
    activeFillUps
      .filter(f => f.vehicleId === selectedVehicleId)
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [activeFillUps, selectedVehicleId]
  );

  // Filter for active vehicle - sorted by odometer for calculations
  const activeVehicleFillUpsByOdometer = useMemo(() => 
    activeFillUps
      .filter(f => f.vehicleId === selectedVehicleId)
      .sort((a,b) => a.odometer - b.odometer),
    [activeFillUps, selectedVehicleId]
  );

  const addFillUp = async (entry) => {
    const now = new Date().toISOString();
    const newRecord = { 
      ...entry, 
      id: Date.now(), 
      vehicleId: selectedVehicleId,
      stableKey: uuidv4(),
      updatedAt: now,
      createdAt: now,
      syncStatus: 'pending',
      lastAction: 'CREATE',
      retryCount: 0
    };
    
    setFillUps(prev => [...prev, newRecord]);
    
    // Trigger background sync
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => {});
    }
  };

  const deleteFillUp = async (id) => {
    const now = new Date().toISOString();
    setFillUps(prev => prev.map(f => 
      f.id === id 
        ? { ...f, deletedAt: now, lastAction: 'DELETE', syncStatus: 'pending', retryCount: 0 } 
        : f
    ));
    
    // Trigger background sync
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => {});
    }
  };

  const deleteMultipleFillUps = async (ids) => {
    const now = new Date().toISOString();
    const idsSet = new Set(ids);
    setFillUps(prev => prev.map(f => 
      idsSet.has(f.id) 
        ? { ...f, deletedAt: now, lastAction: 'DELETE', syncStatus: 'pending', retryCount: 0 } 
        : f
    ));
    
    // Trigger background sync
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => {});
    }
  };

  const updateFillUp = async (id, updatedData) => {
    const now = new Date().toISOString();
    setFillUps(prev => prev.map(f => 
      f.id === id 
        ? { ...f, ...updatedData, updatedAt: now, lastAction: 'UPDATE', syncStatus: 'pending', retryCount: 0 } 
        : f
    ));
    
    // Trigger background sync
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => {});
    }
  };

  const stats = useMemo(() => {
    if (activeVehicleFillUpsByOdometer.length === 0) {
      return { totalFillUps: 0, validTripsCount: 0, avgKmPerLiter: 0, avgL100km: 0, totalCost: 0, totalDistance: 0, totalLiters: 0 };
    }
    
    let validTripDistanceSum = 0;
    let validTripLitersSum = 0;
    let totalCost = 0;

    activeVehicleFillUpsByOdometer.forEach((fill, index) => {
      const metrics = calculateTripMetrics(activeVehicleFillUpsByOdometer, index);
      totalCost += metrics.tripCost;
      
      if (index > 0) {
        validTripDistanceSum += metrics.distance;
        validTripLitersSum += metrics.fuelConsumed;
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
      totalLiters: formatTo2Decimals(
        activeVehicleFillUpsByOdometer.reduce(
          (sum, fill) => sum + (Number(fill.liters) || 0),
          0,
        ),
      )
    };
  }, [activeVehicleFillUpsByOdometer, activeVehicleFillUps.length]);

  return {
    fuelPrices,
    setFuelPrices,
    fillUps,
    setFillUps,
    activeVehicleFillUps,
    activeVehicleFillUpsByOdometer,
    addFillUp,
    deleteFillUp,
    deleteMultipleFillUps,
    updateFillUp,
    stats
  };
}
