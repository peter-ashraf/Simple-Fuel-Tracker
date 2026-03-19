import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { calculateTripMetrics } from '../utils/calculations';

const FuelContext = createContext(null);

export function FuelProvider({ children }) {
  const [vehicles, setVehicles] = useLocalStorage('fueltracker-vehicles-v2', [{ id: 'default', name: 'My Car', type: 'car' }]);
  const [selectedVehicleId, setSelectedVehicleId] = useLocalStorage('fueltracker-active-vehicle-v2', 'default');
  const [fuelPrices, setFuelPrices] = useLocalStorage('fueltracker-prices-v2', { 92: 22.25, 95: 25.00, diesel: 20.50 });
  const [fillUps, setFillUps] = useLocalStorage('fueltracker-fillups-v2', []);

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

  const updateFillUp = (id, updatedData) => {
    setFillUps(prev => prev.map(f => f.id === id ? { ...f, ...updatedData } : f));
  };

  const addVehicle = (vehicle) => {
    const id = `v_${Date.now()}`;
    setVehicles(prev => [...prev, { ...vehicle, id }]);
    setSelectedVehicleId(id);
  };

  const editVehicle = (id, newName) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
  };

  const deleteVehicle = (id) => {
    if (vehicles.length <= 1) return;
    setVehicles(prev => prev.filter(v => v.id !== id));
    setFillUps(prev => prev.filter(f => f.vehicleId !== id));
    if (selectedVehicleId === id) {
       setSelectedVehicleId(vehicles.find(v => v.id !== id).id);
    }
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
    const avgKmPerLiter = validTripLitersSum > 0 ? (validTripDistanceSum / validTripLitersSum) : 0;
    const avgL100km = validTripDistanceSum > 0 ? (validTripLitersSum / validTripDistanceSum) * 100 : 0;

    return {
      totalFillUps: activeVehicleFillUps.length,
      validTripsCount,
      avgKmPerLiter,
      avgL100km,
      totalCost,
      totalDistance: validTripDistanceSum,
      totalLiters: validTripLitersSum + (activeVehicleFillUpsByOdometer.length > 0 && activeVehicleFillUpsByOdometer[0].liters)
    };
  }, [activeVehicleFillUpsByOdometer]);

  return (
    <FuelContext.Provider value={{
      vehicles, selectedVehicleId, setSelectedVehicleId, fuelPrices, setFuelPrices,
      activeVehicleFillUps, activeVehicleFillUpsByOdometer, addFillUp, deleteFillUp, updateFillUp, addVehicle, editVehicle, deleteVehicle,
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
