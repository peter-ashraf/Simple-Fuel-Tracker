import { useMemo, useEffect } from 'react';
import { useLocalStorage } from '../useLocalStorage';
import { MAINTENANCE_CATEGORIES } from '../../data/maintenanceCategories';
import { cloudSyncService } from '../../services/cloudSyncService';

export function useMaintenanceState(selectedVehicleId) {
  const [maintenanceLogs, setMaintenanceLogs] = useLocalStorage('fueltracker-maintenance-logs-v2', []);
  const [maintenanceReminders, setMaintenanceReminders] = useLocalStorage('fueltracker-maintenance-reminders-v2', []);
  const [maintenanceEntries, setMaintenanceEntries] = useLocalStorage('fueltracker-maintenance-entries-v3', []);
  const [categories, setCategories] = useLocalStorage('fueltracker-maintenance-categories-v1', Object.values(MAINTENANCE_CATEGORIES));
  
  const [maintenanceSystems, setMaintenanceSystems] = useLocalStorage('fueltracker-maintenance-systems-v1', [
    { id: 'engine', name: 'Engine', icon: 'Engine', categories: ['oil_change', 'air_filter', 'spark_plugs', 'transmission_service'], color: '#ef4444' },
    { id: 'tires', name: 'Tires', icon: 'Disc', categories: ['tire_rotation', 'tire_replacement'], color: '#3b82f6' },
    { id: 'fluids', name: 'Fluids', icon: 'Drop', categories: ['coolant_flush', 'ac_filter', 'fuel_filter'], color: '#06b6d4' },
    { id: 'safety', name: 'Safety', icon: 'Shield', categories: ['general_inspection'], color: '#f59e0b' },
    { id: 'electrical', name: 'Electrical', icon: 'BatteryCharging', categories: ['battery'], color: '#8b5cf6' },
    { id: 'body', name: 'Body', icon: 'Car', categories: ['custom'], color: '#64748b' }
  ]);

  const [maintenanceSettings, setMaintenanceSettings] = useLocalStorage('fueltracker-maintenance-settings-v2', {
    defaultSafetyMarginKm: 2000,
    categorySettings: {}
  });

  // Icon migration logic
  useEffect(() => {
    const legacyMap = { 'Zap': 'Lightning', 'Droplet': 'Drop', 'Battery': 'BatteryCharging' };
    let hasChanges = false;
    const migratedSystems = maintenanceSystems.map(system => {
      if (system.id === 'engine' && (system.icon === 'Zap' || system.icon === 'Lightning')) {
        hasChanges = true;
        return { ...system, icon: 'Engine' };
      }
      if (legacyMap[system.icon]) {
        hasChanges = true;
        return { ...system, icon: legacyMap[system.icon] };
      }
      return system;
    });
    if (hasChanges) setMaintenanceSystems(migratedSystems);
  }, []);

  const getCategoryById = (id) => {
    return categories.find(cat => cat.id === id) || categories.find(cat => cat.id === 'custom') || categories[0];
  };

  // --- Maintenance Logs (Legacy?) ---
  const addMaintenanceLog = async (log) => {
    setMaintenanceLogs(prev => [...prev, { ...log, id: Date.now(), vehicleId: selectedVehicleId, timestamp: new Date().toISOString() }]);
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };
  const updateMaintenanceLog = async (id, updatedData) => {
    setMaintenanceLogs(prev => prev.map(log => log.id === id ? { ...log, ...updatedData } : log));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };
  const deleteMaintenanceLog = async (id) => {
    setMaintenanceLogs(prev => prev.filter(log => log.id !== id));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  // --- Maintenance Reminders ---
  const addMaintenanceReminder = async (reminder) => {
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
      ...reminder, id: Date.now(), vehicleId: selectedVehicleId, createdAt: new Date().toISOString(),
      nextDueODO, alertODO, safetyMarginKm: safetyMargin
    }]);
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  const updateMaintenanceReminder = async (id, updatedData) => {
    setMaintenanceReminders(prev => prev.map(reminder => {
      if (reminder.id !== id) return reminder;
      const updated = { ...reminder, ...updatedData };
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
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  const deleteMaintenanceReminder = async (id) => {
    setMaintenanceReminders(prev => prev.filter(reminder => reminder.id !== id));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  // --- Maintenance Entries (v3) ---
  const addMaintenanceEntry = async (entry) => {
    const type = entry.type || 'custom';
    const catDef = getCategoryById(type);
    const catSettings = maintenanceSettings?.categorySettings?.[type] || {};
    
    const safetyMargin = entry.safetyMarginKm ?? entry.safety ?? catSettings.safetyMarginKm ?? catDef.defaultSafetyMarginKm ?? 2000;
    const intervalKm = entry.intervalKm ?? entry.distance ?? catSettings.intervalKm ?? catDef.defaultInterval?.value ?? 0;
    
    // Support both naming schemes gracefully
    const odometer = Number(entry.odometer ?? entry.performedAtODO) || 0;
    
    let next_due_odometer = 0;
    if (intervalKm > 0) {
      next_due_odometer = odometer + intervalKm;
    }

    setMaintenanceEntries(prev => [...prev, {
      ...entry, 
      id: `m_${Date.now()}`, 
      vehicleId: selectedVehicleId, 
      timestamp: new Date().toISOString(),
      
      // 🟢 Standarized for Cloud Engine and UI Form parity
      odometer,
      performedAtODO: odometer, // Backwards compatibility fallback for UI views
      
      distance: intervalKm,
      intervalKm,              // Fallback
      
      safety: safetyMargin,
      safetyMarginKm: safetyMargin, // Fallback
      
      next_due_odometer,
      nextDueODO: next_due_odometer, // Fallback
      
      description: entry.description || entry.notes || ''
    }]);

    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  const updateMaintenanceEntry = async (id, updatedData) => {
    setMaintenanceEntries(prev => prev.map(entry => {
      if (entry.id !== id) return entry;
      const updated = { ...entry, ...updatedData };
      const type = updated.type || 'custom';
      const catDef = getCategoryById(type);
      const catSettings = maintenanceSettings?.categorySettings?.[type] || {};
      
      const safetyMargin = updated.safetyMarginKm ?? updated.safety ?? catSettings.safetyMarginKm ?? catDef.defaultSafetyMarginKm ?? 2000;
      const intervalKm = updated.intervalKm ?? updated.distance ?? catSettings.intervalKm ?? catDef.defaultInterval?.value ?? 0;
      
      const odometer = Number(updated.odometer ?? updated.performedAtODO) || 0;
      
      if (intervalKm > 0) {
        updated.next_due_odometer = odometer + intervalKm;
        updated.nextDueODO = updated.next_due_odometer;
      }
      
      return {
        ...updated,
        odometer,
        performedAtODO: odometer,
        distance: intervalKm,
        intervalKm,
        safety: safetyMargin,
        safetyMarginKm: safetyMargin,
        description: updated.description || updated.notes || ''
      };
    }));

    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  const deleteMaintenanceEntry = async (id) => {
    setMaintenanceEntries(prev => prev.filter(entry => entry.id !== id));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  const deleteMultipleMaintenanceEntries = async (ids) => {
    const idsSet = new Set(ids);
    setMaintenanceEntries(prev => prev.filter(entry => !idsSet.has(entry.id)));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  // --- Category Management ---
  const addMaintenanceCategory = async (category) => {
    const newCategory = { ...category, id: category.id || `cat_${Date.now()}`, color: category.color || '#64748b' };
    setCategories(prev => [...prev, newCategory]);
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
    return newCategory;
  };

  const updateMaintenanceCategory = async (id, updates) => {
    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  const deleteMaintenanceCategory = async (id) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
    // Trigger silent background sync after mutation
    const userId = await cloudSyncService.getUserId();
    if (userId) {
      cloudSyncService.syncAfterMutation(userId).catch(err => console.error('[Sync][mutation] Background sync failed:', err));
    }
  };

  // --- Settings ---
  const updateMaintenanceSettings = (updates) => {
    setMaintenanceSettings(prev => ({ ...prev, ...updates }));
  };

  const updateCategorySettings = (categoryId, settings) => {
    setMaintenanceSettings(prev => ({
      ...prev,
      categorySettings: {
        ...prev.categorySettings,
        [categoryId]: { ...prev.categorySettings[categoryId], ...settings }
      }
    }));
  };

  // --- Derived Active Vehicle Lists ---
  const activeVehicleMaintenanceLogs = useMemo(() => 
    maintenanceLogs.filter(log => log.vehicleId === selectedVehicleId)
      .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [maintenanceLogs, selectedVehicleId]
  );

  const activeVehicleMaintenanceReminders = useMemo(() => 
    maintenanceReminders.filter(r => r.vehicleId === selectedVehicleId)
      .sort((a,b) => {
        const aDue = new Date(a.nextDueDate || a.dueDate || '9999-12-31').getTime();
        const bDue = new Date(b.nextDueDate || b.dueDate || '9999-12-31').getTime();
        return aDue - bDue;
      }),
    [maintenanceReminders, selectedVehicleId]
  );

  const activeVehicleMaintenanceEntries = useMemo(() => 
    maintenanceEntries.filter(e => e.vehicleId === selectedVehicleId && !e.deletedAt)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [maintenanceEntries, selectedVehicleId]
  );

  return {
    maintenanceLogs, setMaintenanceLogs,
    maintenanceReminders, setMaintenanceReminders,
    maintenanceEntries, setMaintenanceEntries,
    categories, setCategories,
    maintenanceSystems, setMaintenanceSystems,
    maintenanceSettings, setMaintenanceSettings,
    getCategoryById,
    addMaintenanceLog, updateMaintenanceLog, deleteMaintenanceLog,
    addMaintenanceReminder, updateMaintenanceReminder, deleteMaintenanceReminder,
    addMaintenanceEntry, updateMaintenanceEntry, deleteMaintenanceEntry, deleteMultipleMaintenanceEntries,
    addMaintenanceCategory, updateMaintenanceCategory, deleteMaintenanceCategory,
    updateMaintenanceSettings, updateCategorySettings,
    activeVehicleMaintenanceLogs,
    activeVehicleMaintenanceReminders,
    activeVehicleMaintenanceEntries
  };
}
