export const MAINTENANCE_CATEGORIES = {
  OIL_CHANGE: {
    id: 'oil_change',
    name: 'Oil Change',
    icon: 'oil',
    defaultInterval: { type: 'distance', value: 5000 }, // km
    defaultIntervalTime: { type: 'time', value: 6 }, // months
    color: '#8b5cf6'
  },
  TIRE_ROTATION: {
    id: 'tire_rotation',
    name: 'Tire Rotation',
    icon: 'rotate',
    defaultInterval: { type: 'distance', value: 10000 }, // km
    defaultIntervalTime: { type: 'time', value: 12 }, // months
    color: '#3b82f6'
  },
  TIRE_REPLACEMENT: {
    id: 'tire_replacement',
    name: 'Tire Replacement',
    icon: 'tire',
    defaultInterval: { type: 'distance', value: 40000 }, // km
    defaultIntervalTime: { type: 'time', value: 36 }, // months
    color: '#ef4444'
  },
  BRAKE_SERVICE: {
    id: 'brake_service',
    name: 'Brake Service',
    icon: 'brake',
    defaultInterval: { type: 'distance', value: 20000 }, // km
    defaultIntervalTime: { type: 'time', value: 24 }, // months
    color: '#f59e0b'
  },
  AIR_FILTER: {
    id: 'air_filter',
    name: 'Air Filter',
    icon: 'filter',
    defaultInterval: { type: 'distance', value: 15000 }, // km
    defaultIntervalTime: { type: 'time', value: 12 }, // months
    color: '#10b981'
  },
  FUEL_FILTER: {
    id: 'fuel_filter',
    name: 'Fuel Filter',
    icon: 'filter',
    defaultInterval: { type: 'distance', value: 30000 }, // km
    defaultIntervalTime: { type: 'time', value: 24 }, // months
    color: '#06b6d4'
  },
  SPARK_PLUGS: {
    id: 'spark_plugs',
    name: 'Spark Plugs',
    icon: 'spark',
    defaultInterval: { type: 'distance', value: 45000 }, // km
    defaultIntervalTime: { type: 'time', value: 36 }, // months
    color: '#f97316'
  },
  COOLANT_FLUSH: {
    id: 'coolant_flush',
    name: 'Coolant Flush',
    icon: 'coolant',
    defaultInterval: { type: 'distance', value: 40000 }, // km
    defaultIntervalTime: { type: 'time', value: 24 }, // months
    color: '#14b8a6'
  },
  TRANSMISSION_SERVICE: {
    id: 'transmission_service',
    name: 'Transmission Service',
    icon: 'gear',
    defaultInterval: { type: 'distance', value: 60000 }, // km
    defaultIntervalTime: { type: 'time', value: 48 }, // months
    color: '#a855f7'
  },
  GENERAL_INSPECTION: {
    id: 'general_inspection',
    name: 'General Inspection',
    icon: 'check',
    defaultInterval: { type: 'time', value: 12 }, // months
    color: '#64748b'
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom',
    icon: 'custom',
    defaultInterval: { type: 'distance', value: 10000 }, // km
    defaultIntervalTime: { type: 'time', value: 12 }, // months
    color: '#64748b'
  }
};

export const getMaintenanceCategory = (categoryId) => {
  return MAINTENANCE_CATEGORIES[categoryId.toUpperCase()] || MAINTENANCE_CATEGORIES.CUSTOM;
};

export const getAllCategories = () => {
  return Object.values(MAINTENANCE_CATEGORIES);
};
