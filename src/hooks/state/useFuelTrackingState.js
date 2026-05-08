import { useMemo } from 'react';
import { useLocalStorage } from '../useLocalStorage';
import { calculateTripMetrics } from '../../utils/calculations';
import { formatTo2Decimals } from '../../utils/formatting';

export function useFuelTrackingState(selectedVehicleId) {
  const [fuelPrices, setFuelPrices] = useLocalStorage('fueltracker-prices-v2', { 92: 22.25, 95: 25.00, diesel: 20.50 });
  const [fillUps, setFillUps] = useLocalStorage('fueltracker-fillups-v2', []);

  // Filter for active vehicle - sorted by timestamp for display
  const activeVehicleFillUps = useMemo(() => 
    fillUps
      .filter(f => f.vehicleId === selectedVehicleId)
      .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [fillUps, selectedVehicleId]
  );

  // Filter for active vehicle - sorted by odometer for calculations
  const activeVehicleFillUpsByOdometer = useMemo(() => 
    fillUps
      .filter(f => f.vehicleId === selectedVehicleId)
      .sort((a,b) => a.odometer - b.odometer),
    [fillUps, selectedVehicleId]
  );

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
      totalLiters: formatTo2Decimals(validTripLitersSum + (activeVehicleFillUpsByOdometer.length > 0 ? activeVehicleFillUpsByOdometer[0].liters : 0))
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
