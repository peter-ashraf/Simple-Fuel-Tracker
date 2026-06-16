import { useMemo, useEffect } from 'react';
import { useLocalStorage } from '../useLocalStorage';
import { MAINTENANCE_CATEGORIES } from '../../data/maintenanceCategories';
import { syncLocalChangesInBackground } from './syncAfterMutation';

const dateOnly = (value) => {
  if (!value) return new Date().toISOString().substring(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().substring(0, 10)
    : parsed.toISOString().substring(0, 10);
};

const createStableKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const parseMaintenanceDescription = (description) => {
  if (!description || typeof description !== 'string') return {};
  try {
    const parsed = JSON.parse(description);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export function useMaintenanceState(selectedVehicleId) {
  const [maintenanceLogs, setMaintenanceLogs] = useLocalStorage('fueltracker-maintenance-logs-v2', []);
  const [maintenanceReminders, setMaintenanceReminders] = useLocalStorage('fueltracker-maintenance-reminders-v2', []);
  const [maintenanceEntries, setMaintenanceEntries] = useLocalStorage('fueltracker-maintenance-entries-v3', []);
  const [categories, setCategories] = useLocalStorage('fueltracker-maintenance-categories-v1', Object.values(MAINTENANCE_CATEGORIES));

  const [maintenanceSystems, setMaintenanceSystems] = useLocalStorage('fueltracker-maintenance-systems-v1', [
    { id: 'engine', name: 'Engine', icon: 'Engine', categories: ['oil_change', 'air_filter', 'spark_plugs', 'transmission_service'], color: '#ef4444' },
    { id: 'tires', name: 'Tires', icon: 'Disc', categories: ['tire_rotation', 'tire_replacement'], color: '#3b82f6' },
    { id: 'fluids', name: 'Fluids', icon: 'Drop', categories: ['coolant_flush', 'ac_filter', 'fuel_filter', 'brake_service', 'brake_pads'], color: '#06b6d4' },
    { id: 'safety', name: 'Safety', icon: 'Shield', categories: ['general_inspection'], color: '#f59e0b' },
    { id: 'electrical', name: 'Electrical', icon: 'BatteryCharging', categories: ['battery'], color: '#8b5cf6' },
    { id: 'body', name: 'Body', icon: 'Car', categories: ['custom'], color: '#64748b' }
  ]);

  const [maintenanceSettings, setMaintenanceSettings] = useLocalStorage('fueltracker-maintenance-settings-v2', {
    defaultSafetyMarginKm: 2000,
    categorySettings: {}
  });

  useEffect(() => {
    const legacyMap = { Zap: 'Lightning', Droplet: 'Drop', Battery: 'BatteryCharging' };
    let hasChanges = false;
    const migratedSystems = maintenanceSystems.map((system) => {
      let nextCategories = system.categories || [];
      if (system.id === 'fluids') {
        const missingBrakeCategories = ['brake_service', 'brake_pads'].filter((id) => !nextCategories.includes(id));
        if (missingBrakeCategories.length > 0) {
          nextCategories = [...nextCategories, ...missingBrakeCategories];
          hasChanges = true;
        }
      }

      if (system.id === 'engine' && (system.icon === 'Zap' || system.icon === 'Lightning')) {
        hasChanges = true;
        return { ...system, icon: 'Engine', categories: nextCategories };
      }
      if (legacyMap[system.icon]) {
        hasChanges = true;
        return { ...system, icon: legacyMap[system.icon], categories: nextCategories };
      }
      return { ...system, categories: nextCategories };
    });
    if (hasChanges) setMaintenanceSystems(migratedSystems);
  }, [maintenanceSystems, setMaintenanceSystems]);

  const getCategoryById = (id) => {
    return categories.find((cat) => cat.id === id) || categories.find((cat) => cat.id === 'custom') || categories[0];
  };

  const normalizeMaintenanceEntry = (entry, existing = {}) => {
    const now = new Date().toISOString();
    const type = entry.type || existing.type || 'custom';
    const catDef = getCategoryById(type);
    const catSettings = maintenanceSettings?.categorySettings?.[type] || {};
    const metadata = parseMaintenanceDescription(entry.description ?? existing.description);

    const odometer = Number(entry.odometer ?? entry.performedAtODO ?? existing.odometer ?? existing.performedAtODO ?? 0) || 0;
    const intervalKm = Number(
      entry.intervalKm ??
      entry.distance ??
      metadata.distance ??
      existing.intervalKm ??
      existing.distance ??
      catSettings.intervalKm ??
      catDef.defaultInterval?.value ??
      0
    ) || 0;
    const safetyMargin = Number(
      entry.safetyMarginKm ??
      entry.safety ??
      metadata.safety ??
      existing.safetyMarginKm ??
      existing.safety ??
      catSettings.safetyMarginKm ??
      catDef.defaultSafetyMarginKm ??
      maintenanceSettings.defaultSafetyMarginKm ??
      2000
    ) || 0;
    const nextDue = intervalKm > 0
      ? odometer + intervalKm
      : Number(entry.nextDueODO ?? entry.next_due_odometer ?? existing.nextDueODO ?? existing.next_due_odometer ?? 0) || 0;
    const alertODO = nextDue > 0 ? nextDue - safetyMargin : null;
    const date = dateOnly(entry.date ?? entry.maintenanceDate ?? entry.timestamp ?? existing.date ?? existing.timestamp ?? now);
    const notes = entry.notes ?? metadata.notes ?? existing.notes ?? '';
    const rawCost = entry.cost !== undefined && entry.cost !== '' ? entry.cost : existing.cost;
    const cost = rawCost !== undefined && rawCost !== null && rawCost !== '' ? Number(rawCost) : null;
    const stableKey = entry.stableKey ?? entry.stable_key ?? existing.stableKey ?? existing.stable_key ?? createStableKey();

    return {
      ...existing,
      ...entry,
      id: entry.id ?? existing.id ?? `m_${Date.now()}`,
      stableKey,
      stable_key: stableKey,
      vehicleId: entry.vehicleId ?? existing.vehicleId ?? selectedVehicleId,
      type,
      date,
      timestamp: date,
      odometer,
      performedAtODO: odometer,
      distance: intervalKm,
      intervalKm,
      safety: safetyMargin,
      safetyMarginKm: safetyMargin,
      next_due_odometer: nextDue,
      nextDueOdometer: nextDue,
      nextDueODO: nextDue,
      alertODO,
      description: JSON.stringify({ distance: intervalKm, safety: safetyMargin, notes }),
      notes,
      cost: Number.isNaN(cost) ? null : cost,
      createdAt: entry.createdAt ?? entry.created_at ?? existing.createdAt ?? existing.created_at ?? now,
      updatedAt: now,
      deletedAt: entry.deletedAt ?? entry.deleted_at ?? existing.deletedAt ?? null,
      pendingDelete: entry.pendingDelete ?? existing.pendingDelete ?? false,
      pendingDeleteRequestedAt: entry.pendingDeleteRequestedAt ?? existing.pendingDeleteRequestedAt ?? null,
      lastAction: entry.lastAction ?? existing.lastAction ?? 'UPDATE',
      tombstoneVerifiedAt: entry.tombstoneVerifiedAt ?? existing.tombstoneVerifiedAt ?? null
    };
  };

  const addMaintenanceLog = async (log) => {
    setMaintenanceLogs((prev) => [...prev, { ...log, id: Date.now(), vehicleId: selectedVehicleId, timestamp: new Date().toISOString() }]);
    syncLocalChangesInBackground();
  };

  const updateMaintenanceLog = async (id, updatedData) => {
    setMaintenanceLogs((prev) => prev.map((log) => log.id === id ? { ...log, ...updatedData } : log));
    syncLocalChangesInBackground();
  };

  const deleteMaintenanceLog = async (id) => {
    setMaintenanceLogs((prev) => prev.filter((log) => log.id !== id));
    syncLocalChangesInBackground();
  };

  const addMaintenanceReminder = async (reminder) => {
    const safetyMargin = reminder.safetyMarginKm ?? maintenanceSettings.defaultSafetyMarginKm ?? 2000;
    const baseODO = reminder.performedAtOdometer ?? reminder.odometerThreshold ?? 0;
    const interval = reminder.odometerInterval ?? 0;
    const nextDueODO = baseODO > 0 && interval > 0 ? baseODO + interval : null;
    const alertODO = nextDueODO ? nextDueODO - safetyMargin : null;
    setMaintenanceReminders((prev) => [...prev, {
      ...reminder,
      id: Date.now(),
      vehicleId: selectedVehicleId,
      createdAt: new Date().toISOString(),
      nextDueODO,
      alertODO,
      safetyMarginKm: safetyMargin
    }]);
    syncLocalChangesInBackground();
  };

  const updateMaintenanceReminder = async (id, updatedData) => {
    setMaintenanceReminders((prev) => prev.map((reminder) => {
      if (reminder.id !== id) return reminder;
      const updated = { ...reminder, ...updatedData };
      const safetyMargin = updated.safetyMarginKm ?? maintenanceSettings.defaultSafetyMarginKm ?? 2000;
      const baseODO = updated.performedAtOdometer ?? updated.odometerThreshold ?? 0;
      const interval = updated.odometerInterval ?? 0;
      if (baseODO > 0 && interval > 0) {
        updated.nextDueODO = baseODO + interval;
        updated.alertODO = updated.nextDueODO - safetyMargin;
      }
      return updated;
    }));
    syncLocalChangesInBackground();
  };

  const deleteMaintenanceReminder = async (id) => {
    setMaintenanceReminders((prev) => prev.filter((reminder) => reminder.id !== id));
    syncLocalChangesInBackground();
  };

  const addMaintenanceEntry = async (entry) => {
    setMaintenanceEntries((prev) => [...prev, normalizeMaintenanceEntry(entry)]);
    syncLocalChangesInBackground();
  };

  const updateMaintenanceEntry = async (id, updatedData) => {
    setMaintenanceEntries((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      return normalizeMaintenanceEntry(updatedData, entry);
    }));
    syncLocalChangesInBackground();
  };

  const requestMaintenanceEntryDelete = async (id) => {
    setMaintenanceEntries((prev) => prev.map((entry) => entry.id === id
      ? { ...entry, pendingDelete: true, pendingDeleteRequestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : entry
    ));
  };

  const undoMaintenanceEntryDelete = async (id) => {
    setMaintenanceEntries((prev) => prev.map((entry) => entry.id === id
      ? { ...entry, pendingDelete: false, pendingDeleteRequestedAt: null, updatedAt: new Date().toISOString() }
      : entry
    ));
  };

  const deleteMaintenanceEntry = async (id) => {
    const deletedAt = new Date().toISOString();
    setMaintenanceEntries((prev) => prev.map((entry) => entry.id === id
      ? {
          ...entry,
          pendingDelete: false,
          pendingDeleteRequestedAt: null,
          deletedAt,
          deleted_at: deletedAt,
          lastAction: 'DELETE',
          updatedAt: deletedAt,
          tombstoneVerifiedAt: null
        }
      : entry
    ));
    syncLocalChangesInBackground();
  };

  const deleteMultipleMaintenanceEntries = async (ids) => {
    const idsSet = new Set(ids);
    const deletedAt = new Date().toISOString();
    setMaintenanceEntries((prev) => prev.map((entry) => idsSet.has(entry.id)
      ? { ...entry, deletedAt, deleted_at: deletedAt, lastAction: 'DELETE', updatedAt: deletedAt, tombstoneVerifiedAt: null }
      : entry
    ));
    syncLocalChangesInBackground();
  };

  const addMaintenanceCategory = async (category) => {
    const newCategory = { ...category, id: category.id || `cat_${Date.now()}`, color: category.color || '#64748b' };
    setCategories((prev) => [...prev, newCategory]);
    syncLocalChangesInBackground();
    return newCategory;
  };

  const updateMaintenanceCategory = async (id, updates) => {
    setCategories((prev) => prev.map((cat) => cat.id === id ? { ...cat, ...updates } : cat));
    syncLocalChangesInBackground();
  };

  const deleteMaintenanceCategory = async (id) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
    syncLocalChangesInBackground();
  };

  const updateMaintenanceSettings = (updates) => {
    setMaintenanceSettings((prev) => ({ ...prev, ...updates }));
    syncLocalChangesInBackground();
  };

  const updateCategorySettings = (categoryId, settings) => {
    setMaintenanceSettings((prev) => ({
      ...prev,
      categorySettings: {
        ...prev.categorySettings,
        [categoryId]: { ...prev.categorySettings[categoryId], ...settings }
      }
    }));
    syncLocalChangesInBackground();
  };

  const activeVehicleMaintenanceLogs = useMemo(() =>
    maintenanceLogs.filter((log) => log.vehicleId === selectedVehicleId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [maintenanceLogs, selectedVehicleId]
  );

  const activeVehicleMaintenanceReminders = useMemo(() =>
    maintenanceReminders.filter((r) => r.vehicleId === selectedVehicleId)
      .sort((a, b) => {
        const aDue = new Date(a.nextDueDate || a.dueDate || '9999-12-31').getTime();
        const bDue = new Date(b.nextDueDate || b.dueDate || '9999-12-31').getTime();
        return aDue - bDue;
      }),
    [maintenanceReminders, selectedVehicleId]
  );

  const activeVehicleMaintenanceEntries = useMemo(() =>
    maintenanceEntries.filter((e) => e.vehicleId === selectedVehicleId && !e.deletedAt && !e.deleted_at && !e.pendingDelete)
      .sort((a, b) => new Date(b.timestamp || b.date || 0).getTime() - new Date(a.timestamp || a.date || 0).getTime()),
    [maintenanceEntries, selectedVehicleId]
  );

  return {
    maintenanceLogs, setMaintenanceLogs,
    maintenanceReminders, setMaintenanceReminders,
    maintenanceEntries: activeVehicleMaintenanceEntries,
    allMaintenanceEntries: maintenanceEntries,
    setMaintenanceEntries,
    categories, setCategories,
    maintenanceSystems, setMaintenanceSystems,
    maintenanceSettings, setMaintenanceSettings,
    getCategoryById,
    addMaintenanceLog, updateMaintenanceLog, deleteMaintenanceLog,
    addMaintenanceReminder, updateMaintenanceReminder, deleteMaintenanceReminder,
    addMaintenanceEntry, updateMaintenanceEntry, requestMaintenanceEntryDelete, undoMaintenanceEntryDelete, deleteMaintenanceEntry, deleteMultipleMaintenanceEntries,
    addMaintenanceCategory, updateMaintenanceCategory, deleteMaintenanceCategory,
    updateMaintenanceSettings, updateCategorySettings,
    activeVehicleMaintenanceLogs,
    activeVehicleMaintenanceReminders,
    activeVehicleMaintenanceEntries
  };
}
