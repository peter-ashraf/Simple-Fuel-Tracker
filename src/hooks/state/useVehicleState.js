import { useMemo } from 'react';
import { useLocalStorage } from '../useLocalStorage';

export function useVehicleState() {
  const [vehicles, setVehicles] = useLocalStorage('fueltracker-vehicles-v2', [{ id: 'default', name: 'My Car', type: 'car' }]);
  const [selectedVehicleId, setSelectedVehicleId] = useLocalStorage('fueltracker-active-vehicle-v2', 'default');

  const activeVehicle = useMemo(() => 
    vehicles.find(v => v.id === selectedVehicleId) || vehicles[0], 
    [vehicles, selectedVehicleId]
  );

  const addVehicle = (vehicle) => {
    const id = `v_${Date.now()}`;
    const newVehicle = { ...vehicle, id };
    setVehicles(prev => [...prev, newVehicle]);
    setSelectedVehicleId(id);
    return newVehicle;
  };

  const editVehicle = (id, updates) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const internalDeleteVehicle = (id) => {
    if (vehicles.length <= 1) return false;
    
    setVehicles(prev => prev.filter(v => v.id !== id));
    
    if (selectedVehicleId === id) {
      const remaining = vehicles.find(v => v.id !== id);
      if (remaining) {
        setSelectedVehicleId(remaining.id);
      }
    }
    return true;
  };

  return {
    vehicles,
    setVehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    activeVehicle,
    addVehicle,
    editVehicle,
    internalDeleteVehicle
  };
}
