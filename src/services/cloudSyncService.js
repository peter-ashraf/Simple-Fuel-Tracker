import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const LOCALSTORAGE_KEYS = [
  'fueltracker-vehicles-v2',
  'fueltracker-active-vehicle-v2',
  'fueltracker-prices-v2',
  'fueltracker-fillups-v2',
  'fueltracker-theme',
  'fueltracker-user-stations',
  'fueltracker-trip-estimates-v2',
  'fueltracker-tyre-comparisons-v2',
  'fueltracker-maintenance-entries-v3',
  'fueltracker-maintenance-reminders-v2'
];

const SYNC_QUEUE_KEY = 'fueltracker-sync-queue';
const MIGRATION_FLAG_KEY = 'fueltracker-migration-complete';
const MIGRATION_DECISION_KEY = 'fueltracker-migration-decision';
const CLOUD_SYNCED_FLAG_KEY = 'fueltracker-cloud-synced-timestamp';
const BACKGROUND_SYNC_LOCK_KEY = 'fueltracker-background-sync-lock';
const COUNTS_MATCHED_NO_CONFLICT_KEY = 'fueltracker-counts-matched-no-conflict';

// Store online listener reference to prevent duplicates
let onlineListener = null;

// Background sync state
let backgroundSyncInProgress = false;
let backgroundSyncPromise = null;

// Initialization state guards
let initializationInProgress = false;
let initializationPromise = null;
let latestInitializationId = 0;

/**
 * Validate if a string is a valid UUID (any version)
 * PostgreSQL uuid columns accept UUIDs from any version or origin, not just v4.
 * Using a v4-only validator could incorrectly treat valid non-v4 UUIDs as invalid
 * and cause unnecessary ID remapping during migration, which is unsafe.
 * @param {string} value - Value to validate
 * @returns {boolean} True if valid UUID (any version)
 */
function isValidUuid(value) {
  if (typeof value !== 'string') return false;
  const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return UUID_REGEX.test(value.trim());
}

/**
 * Generate a stable key for a vehicle
 * Uses UUID v4 for new vehicles, or deterministic hash for legacy vehicles
 * @param {Object} vehicle - Vehicle object
 * @returns {string} Stable key
 */
function generateStableKey(vehicle) {
  // If vehicle already has a stable key, return it
  if (vehicle.stableKey && isValidUuid(vehicle.stableKey)) {
    return vehicle.stableKey;
  }
  
  // For legacy vehicles without stable key, generate a UUID
  // This will be stable across future exports/imports
  return uuidv4();
}

/**
 * Backfill stable keys for legacy vehicles
 * @param {Array} vehicles - Vehicle records
 * @returns {Array} Vehicles with backfilled stable keys
 */
function backfillStableKeys(vehicles) {
  console.log('[Sync][vehicle] Backfilling stable keys for legacy vehicles');
  
  const updatedVehicles = vehicles.map(vehicle => {
    if (vehicle.stableKey && isValidUuid(vehicle.stableKey)) {
      console.log(`[Sync][vehicle] Vehicle ${vehicle.id} already has stable key: ${vehicle.stableKey}`);
      return vehicle;
    }
    
    const stableKey = generateStableKey(vehicle);
    console.log(`[Sync][vehicle] Backfilled stable key for vehicle ${vehicle.id}: ${stableKey}`);
    return { ...vehicle, stableKey };
  });
  
  // Persist updated vehicles with stable keys to localStorage immediately
  localStorage.setItem('fueltracker-vehicles-v2', JSON.stringify(updatedVehicles));
  console.log(`[Sync][vehicle] Persisted ${updatedVehicles.length} vehicles with stable keys to localStorage`);
  
  return updatedVehicles;
}

/**
 * Backfill stable keys for legacy fillups and persist to localStorage
 * @param {Array} fillups - Fillup records
 * @returns {Array} Fillups with stable keys
 */
function backfillStableKeysForFillups(fillups) {
  console.log('[Sync][fillup] Backfilling stable keys for legacy fillups');
  
  const updatedFillups = fillups.map(fillup => {
    if (fillup.stableKey && isValidUuid(fillup.stableKey)) {
      console.log(`[Sync][fillup] Fillup ${fillup.id} already has stable key: ${fillup.stableKey}`);
      return fillup;
    }
    
    const stableKey = generateStableKey(fillup);
    console.log(`[Sync][fillup] Backfilled stable key for fillup ${fillup.id}: ${stableKey}`);
    return { ...fillup, stableKey };
  });
  
  // Persist updated fillups with stable keys to localStorage immediately
  localStorage.setItem('fueltracker-fillups-v2', JSON.stringify(updatedFillups));
  console.log(`[Sync][fillup] Persisted ${updatedFillups.length} fillups with stable keys to localStorage`);
  
  return updatedFillups;
}

/**
 * Normalize vehicle object for matching (handles camelCase/snake_case differences)
 * @param {Object} vehicle - Vehicle object from local or cloud
 * @param {string} source - 'local' or 'cloud'
 * @returns {Object} Normalized vehicle object with consistent field names
 */
function normalizeVehicleForMatch(vehicle, source) {
  // Handle snake_case to camelCase conversion for cloud data
  if (source === 'cloud') {
    return {
      id: vehicle.id,
      stableKey: vehicle.stable_key || vehicle.stableKey,
      name: vehicle.name,
      tankCapacity: vehicle.tank_capacity || vehicle.tankCapacity,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      fuelType: vehicle.fuel_type || vehicle.fuelType,
      licensePlate: vehicle.license_plate || vehicle.licensePlate,
      tyreWidth: vehicle.tyre_width || vehicle.tyreWidth,
      tyreAspectRatio: vehicle.tyre_aspect_ratio || vehicle.tyreAspectRatio,
      tyreRimSize: vehicle.tyre_rim_size || vehicle.tyreRimSize
    };
  }
  
  // Local data is already in camelCase
  return {
    id: vehicle.id,
    stableKey: vehicle.stableKey,
    name: vehicle.name,
    tankCapacity: vehicle.tankCapacity,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
    licensePlate: vehicle.licensePlate,
    tyreWidth: vehicle.tyreWidth,
    tyreAspectRatio: vehicle.tyreAspectRatio,
    tyreRimSize: vehicle.tyreRimSize
  };
}

/**
 * Generate a fingerprint for vehicle matching (fallback for legacy data)
 * @param {Object} vehicle - Normalized vehicle object
 * @returns {string} Fingerprint string
 */
function generateVehicleFingerprint(vehicle) {
  const parts = [
    vehicle.name,
    vehicle.tankCapacity,
    vehicle.make,
    vehicle.model,
    vehicle.year
  ];

  return parts
    .map(v => (v ?? '').toString().toLowerCase().trim())
    .join('|');
}

/**
 * Generate a fingerprint for fillup matching (fallback for legacy data)
 * @param {Object} fillup - Normalized fillup object
 * @returns {string} Fingerprint string
 */
function generateFillupFingerprint(fillup) {
  const parts = [
    fillup.vehicleId,
    fillup.date,
    fillup.odometer?.toString() || '',
    fillup.liters?.toString() || '',
    fillup.pricePerLiter?.toString() || '',
    fillup.totalCost?.toString() || ''
  ];

  return parts
    .map(v => (v ?? '').toString().toLowerCase().trim())
    .join('|');
}

/**
 * Match vehicles by stable key or fingerprint (with normalization)
 * @param {Array} localVehicles - Local vehicle records
 * @param {Array} cloudVehicles - Cloud vehicle records
 * @returns {Object} { matches: Map, unmatchedLocal: Array, unmatchedCloud: Array }
 */
function matchVehicles(localVehicles, cloudVehicles) {
  const matches = new Map(); // localId -> cloudId
  const cloudByStableKey = new Map();
  const cloudByFingerprint = new Map();
  
  // Build cloud lookup maps with normalization
  cloudVehicles.forEach(cloudVehicle => {
    const normalized = normalizeVehicleForMatch(cloudVehicle, 'cloud');
    if (normalized.stableKey) {
      cloudByStableKey.set(normalized.stableKey, cloudVehicle);
    }
    const fingerprint = generateVehicleFingerprint(normalized);
    cloudByFingerprint.set(fingerprint, cloudVehicle);
  });
  
  const unmatchedLocal = [];
  const unmatchedCloud = [...cloudVehicles];
  
  // Match local vehicles to cloud vehicles with normalization
  localVehicles.forEach(localVehicle => {
    const normalizedLocal = normalizeVehicleForMatch(localVehicle, 'local');
    const stableKey = normalizedLocal.stableKey;
    const fingerprint = generateVehicleFingerprint(normalizedLocal);
    
    console.log(`[Sync][vehicle] Matching local vehicle ${localVehicle.id}: stableKey=${stableKey}, fingerprint=${fingerprint}`);
    
    // First try stable key match
    if (stableKey && cloudByStableKey.has(stableKey)) {
      const cloudVehicle = cloudByStableKey.get(stableKey);
      matches.set(localVehicle.id, cloudVehicle.id);
      console.log(`[Sync][vehicle] Matched local vehicle ${localVehicle.id} to cloud vehicle ${cloudVehicle.id} by stable key`);
      
      // Remove from unmatched cloud
      const idx = unmatchedCloud.findIndex(v => v.id === cloudVehicle.id);
      if (idx !== -1) unmatchedCloud.splice(idx, 1);
      return;
    }
    
    // Fallback to fingerprint match for legacy vehicles
    if (cloudByFingerprint.has(fingerprint)) {
      const cloudVehicle = cloudByFingerprint.get(fingerprint);
      matches.set(localVehicle.id, cloudVehicle.id);
      console.log(`[Sync][vehicle] Matched local vehicle ${localVehicle.id} to cloud vehicle ${cloudVehicle.id} by fallback fingerprint`);
      
      // Remove from unmatched cloud
      const idx = unmatchedCloud.findIndex(v => v.id === cloudVehicle.id);
      if (idx !== -1) unmatchedCloud.splice(idx, 1);
      return;
    }
    
    // No match found
    console.log(`[Sync][vehicle] No match found for local vehicle ${localVehicle.id}`);
    unmatchedLocal.push(localVehicle);
  });
  
  return { matches, unmatchedLocal, unmatchedCloud };
}

/**
 * Sync tombstones (deleted records) to cloud
 * @param {string} userId - User ID
 * @param {Array} localRecords - Local records with deleted_at
 * @param {string} tableName - Table name
 * @returns {Promise<Object>} Sync result
 */
async function syncTombstonesToCloud(userId, localRecords, tableName) {
  const deletedRecords = localRecords.filter(r => r.deletedAt);
  if (deletedRecords.length === 0) {
    return { synced: 0, errors: 0 };
  }
  
  console.log(`[Sync][delete] Syncing ${deletedRecords.length} tombstones to ${tableName}`);
  
  let synced = 0;
  let errors = 0;
  
  for (const record of deletedRecords) {
    const { error } = await supabase.from(tableName).update({
      deleted_at: record.deletedAt
    }).eq('id', record.id).eq('user_id', userId);
    
    if (error) {
      errors++;
      console.error(`[Sync][delete] Failed to sync tombstone for ${record.id}: ${error.message}`);
    } else {
      synced++;
    }
  }
  
  console.log(`[Sync][delete] Tombstone sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Detect if there are any changes between local and cloud records
 * @param {Object} localData - Local data summary
 * @param {Object} cloudData - Cloud data summary
 * @returns {Object} { hasChanges: boolean, changeType: string }
 */
function detectChanges(localData, cloudData) {
  // Check for new records
  const newVehicles = localData.vehicles.filter(v => !cloudData.vehicles.some(cv => cv.stable_key === v.stableKey));
  const newFillups = localData.fillups.filter(f => !cloudData.fillups.some(cf => cf.stable_key === f.stableKey));
  const newMaintenance = localData.maintenance.filter(m => !cloudData.maintenance.some(cm => cm.id === m.id));
  const newTrips = localData.tripEstimates.filter(t => !cloudData.tripEstimates.some(ct => ct.id === t.id));
  
  // Check for updated records (simplified comparison)
  const updatedVehicles = localData.vehicles.filter(v => {
    const cloudV = cloudData.vehicles.find(cv => cv.stable_key === v.stableKey);
    if (!cloudV) return false;
    // Compare actual persisted fields
    return v.name !== cloudV.name ||
           v.make !== cloudV.make ||
           v.model !== cloudV.model ||
           v.year !== cloudV.year ||
           v.fuelType !== cloudV.fuel_type ||
           v.tankCapacity !== cloudV.tank_capacity ||
           v.licensePlate !== cloudV.license_plate;
  });
  
  // Check for deleted records (local has record that cloud doesn't, and not new)
  const deletedVehicles = cloudData.vehicles.filter(cv => !localData.vehicles.some(lv => lv.stableKey === cv.stable_key));
  const deletedFillups = cloudData.fillups.filter(cf => !localData.fillups.some(lf => lf.stableKey === cf.stable_key));
  
  const hasNewRecords = newVehicles.length > 0 || newFillups.length > 0 || newMaintenance.length > 0 || newTrips.length > 0;
  const hasUpdates = updatedVehicles.length > 0;
  const hasDeletions = deletedVehicles.length > 0 || deletedFillups.length > 0;
  
  let changeType = 'none';
  if (hasDeletions) changeType = 'deletions';
  else if (hasUpdates) changeType = 'updates';
  else if (hasNewRecords) changeType = 'inserts';
  
  return {
    hasChanges: hasNewRecords || hasUpdates || hasDeletions,
    changeType,
    newVehicles: newVehicles.length,
    newFillups: newFillups.length,
    updatedVehicles: updatedVehicles.length,
    deletedVehicles: deletedVehicles.length
  };
}

/**
 * Detect duplicate fillup by business fields (fallback for historical bad data)
 * @param {Object} fillup - Fillup to check
 * @param {Array} existingFillups - Existing cloud fillups
 * @returns {Object} { isDuplicate: boolean, existingId: string | null }
 */
function detectDuplicateFillupByFields(fillup, existingFillups) {
  const normalized = {
    user_id: fillup.userId,
    vehicle_id: fillup.vehicleId,
    date: fillup.date,
    odometer: fillup.odometer,
    liters: fillup.liters,
    price_per_liter: fillup.pricePerLiter
  };
  
  for (const existing of existingFillups) {
    if (
      existing.user_id === normalized.user_id &&
      existing.vehicle_id === normalized.vehicle_id &&
      existing.date === normalized.date &&
      existing.odometer === normalized.odometer &&
      existing.liters === normalized.liters &&
      existing.price_per_liter === normalized.price_per_liter
    ) {
      return { isDuplicate: true, existingId: existing.id };
    }
  }
  
  return { isDuplicate: false, existingId: null };
}

/**
 * Normalize a fillup record for cloud upload/merge
 * Remaps vehicleId, validates required fields, computes missing total_cost
 * @param {Object} fillup - Original fillup record
 * @param {Map} vehicleIdMap - Map of old vehicle IDs to new UUIDs
 * @returns {Object} { normalized: Object, skipped: boolean, reason: string }
 */
function normalizeFillupForCloud(fillup, vehicleIdMap) {
  const id = fillup.id || 'unknown';
  console.log(`[Sync][fillup] Normalizing fillup ${id}`);

  // Remap vehicleId if needed
  const oldVehicleId = fillup.vehicleId;
  const newVehicleId = vehicleIdMap.has(oldVehicleId) ? vehicleIdMap.get(oldVehicleId) : oldVehicleId;

  // Validate required fields
  if (!newVehicleId) {
    console.log(`[Sync][fillup] Skipping fillup ${id} due to missing vehicleId`);
    return { normalized: null, skipped: true, reason: 'missing vehicleId' };
  }

  if (!fillup.odometer || fillup.odometer === null || fillup.odometer === undefined) {
    console.log(`[Sync][fillup] Skipping fillup ${id} due to missing odometer`);
    return { normalized: null, skipped: true, reason: 'missing odometer' };
  }

  if (!fillup.liters || fillup.liters === null || fillup.liters === undefined) {
    console.log(`[Sync][fillup] Skipping fillup ${id} due to missing liters`);
    return { normalized: null, skipped: true, reason: 'missing liters' };
  }

  if (!fillup.pricePerLiter || fillup.pricePerLiter === null || fillup.pricePerLiter === undefined) {
    console.log(`[Sync][fillup] Skipping fillup ${id} due to missing pricePerLiter`);
    return { normalized: null, skipped: true, reason: 'missing pricePerLiter' };
  }

  // Convert numeric strings to numbers
  const odometer = Number(fillup.odometer);
  const liters = Number(fillup.liters);
  const pricePerLiter = Number(fillup.pricePerLiter);

  // Compute total_cost if missing or invalid
  let totalCost = fillup.totalCost;
  let computedTotal = false;

  if (totalCost === null || totalCost === undefined || totalCost === '' || isNaN(Number(totalCost))) {
    if (!isNaN(liters) && !isNaN(pricePerLiter) && liters > 0 && pricePerLiter >= 0) {
      totalCost = liters * pricePerLiter;
      // Round to 2 decimal places for currency
      totalCost = Math.round(totalCost * 100) / 100;
      computedTotal = true;
      console.log(`[Sync][fillup] Computed totalCost from liters * pricePerLiter: ${totalCost}`);
    } else {
      console.log(`[Sync][fillup] Skipping fillup ${id} due to unable to compute totalCost`);
      return { normalized: null, skipped: true, reason: 'unable to compute totalCost' };
    }
  } else {
    totalCost = Number(totalCost);
  }

  // Build normalized payload
  const normalized = {
    id: fillup.id,
    user_id: null, // Will be set by caller
    vehicle_id: newVehicleId,
    date: fillup.date || new Date().toISOString().split('T')[0],
    odometer: odometer,
    liters: liters,
    price_per_liter: pricePerLiter,
    total_cost: totalCost,
    station: fillup.station || null,
    notes: fillup.notes || null,
    full_tank: fillup.fullTank !== undefined ? fillup.fullTank : true,
    created_at: fillup.createdAt || new Date().toISOString()
  };

  console.log(`[Sync][fillup] Final payload for fillup ${id}: vehicleId=${newVehicleId}, totalCost=${totalCost}${computedTotal ? ' (computed)' : ''}`);

  return { normalized, skipped: false, reason: null, computedTotal };
}

/**
 * Remap legacy IDs to UUIDs for upload
 * @param {Array} vehicles - Vehicle records
 * @param {Array} fillups - Fillup records
 * @param {Array} maintenance - Maintenance records
 * @param {Array} tripEstimates - Trip estimate records
 * @returns {Object} Remapped data and mapping summary
 */
function remapLegacyIds(vehicles, fillups, maintenance, tripEstimates) {
  console.log('[Sync][uuid] Starting UUID remapping');
  
  // Test: Verify general UUID validation accepts non-v4 UUIDs
  console.log('[Sync][uuid] Test: UUID v1 "00000000-0000-1000-8000-000000000000" valid:', isValidUuid('00000000-0000-1000-8000-000000000000'));
  console.log('[Sync][uuid] Test: UUID v4 "550e8400-e29b-41d4-a716-446655440000" valid:', isValidUuid('550e8400-e29b-41d4-a716-446655440000'));
  console.log('[Sync][uuid] Test: Legacy ID "default" valid:', isValidUuid('default'));
  
  const vehicleIdMap = new Map();
  const fillupIdMap = new Map();
  const maintenanceIdMap = new Map();
  const tripIdMap = new Map();
  
  let preservedVehicleUuids = 0;
  let regeneratedVehicleIds = 0;
  let preservedFillupUuids = 0;
  let regeneratedFillupIds = 0;
  let preservedMaintenanceUuids = 0;
  let regeneratedMaintenanceIds = 0;
  let preservedTripUuids = 0;
  let regeneratedTripIds = 0;
  let remappedForeignKeys = 0;
  
  // Remap vehicle IDs
  const remappedVehicles = vehicles.map(vehicle => {
    const oldId = vehicle.id;
    if (isValidUuid(oldId)) {
      preservedVehicleUuids++;
      console.log(`[Sync][uuid] Vehicle ID preserved: ${oldId}`);
      return vehicle;
    } else {
      const newId = uuidv4();
      regeneratedVehicleIds++;
      vehicleIdMap.set(oldId, newId);
      console.log(`[Sync][uuid] Vehicle ID remapped from "${oldId}" to "${newId}"`);
      return { ...vehicle, id: newId };
    }
  });
  
  // Remap fillup IDs and vehicle references
  const remappedFillups = fillups.map(fillup => {
    const oldId = fillup.id;
    let newId = oldId;
    
    // Remap fillup ID if invalid
    if (!isValidUuid(oldId)) {
      newId = uuidv4();
      regeneratedFillupIds++;
      fillupIdMap.set(oldId, newId);
      console.log(`[Sync][uuid] Fillup ID remapped from "${oldId}" to "${newId}"`);
    } else {
      preservedFillupUuids++;
    }
    
    // Remap vehicleId reference if needed
    const oldVehicleId = fillup.vehicleId;
    if (vehicleIdMap.has(oldVehicleId)) {
      const newVehicleId = vehicleIdMap.get(oldVehicleId);
      remappedForeignKeys++;
      console.log(`[Sync][uuid] Fillup vehicleId remapped from "${oldVehicleId}" to "${newVehicleId}"`);
      return { ...fillup, id: newId, vehicleId: newVehicleId };
    }
    
    return { ...fillup, id: newId };
  });
  
  // Remap maintenance IDs and vehicle references
  const remappedMaintenance = maintenance.map(entry => {
    const oldId = entry.id;
    let newId = oldId;
    
    // Remap maintenance ID if invalid
    if (!isValidUuid(oldId)) {
      newId = uuidv4();
      regeneratedMaintenanceIds++;
      maintenanceIdMap.set(oldId, newId);
      console.log(`[Sync][uuid] Maintenance ID remapped from "${oldId}" to "${newId}"`);
    } else {
      preservedMaintenanceUuids++;
    }
    
    // Remap vehicleId reference if needed
    const oldVehicleId = entry.vehicleId;
    if (vehicleIdMap.has(oldVehicleId)) {
      const newVehicleId = vehicleIdMap.get(oldVehicleId);
      remappedForeignKeys++;
      console.log(`[Sync][uuid] Maintenance vehicleId remapped from "${oldVehicleId}" to "${newVehicleId}"`);
      return { ...entry, id: newId, vehicleId: newVehicleId };
    }
    
    return { ...entry, id: newId };
  });
  
  // Remap trip estimate IDs and vehicle references
  const remappedTripEstimates = tripEstimates.map(estimate => {
    const oldId = estimate.id;
    let newId = oldId;
    
    // Remap trip ID if invalid
    if (!isValidUuid(oldId)) {
      newId = uuidv4();
      regeneratedTripIds++;
      tripIdMap.set(oldId, newId);
      console.log(`[Sync][uuid] Trip estimate ID remapped from "${oldId}" to "${newId}"`);
    } else {
      preservedTripUuids++;
    }
    
    // Remap vehicleId reference if needed
    const oldVehicleId = estimate.vehicleId;
    if (vehicleIdMap.has(oldVehicleId)) {
      const newVehicleId = vehicleIdMap.get(oldVehicleId);
      remappedForeignKeys++;
      console.log(`[Sync][uuid] Trip estimate vehicleId remapped from "${oldVehicleId}" to "${newVehicleId}"`);
      return { ...estimate, id: newId, vehicleId: newVehicleId };
    }
    
    return { ...estimate, id: newId };
  });
  
  const summary = {
    preservedUuids: preservedVehicleUuids + preservedFillupUuids + preservedMaintenanceUuids + preservedTripUuids,
    regeneratedIds: regeneratedVehicleIds + regeneratedFillupIds + regeneratedMaintenanceIds + regeneratedTripIds,
    remappedForeignKeys,
    details: {
      vehicles: { preserved: preservedVehicleUuids, regenerated: regeneratedVehicleIds },
      fillups: { preserved: preservedFillupUuids, regenerated: regeneratedFillupIds },
      maintenance: { preserved: preservedMaintenanceUuids, regenerated: regeneratedMaintenanceIds },
      trips: { preserved: preservedTripUuids, regenerated: regeneratedTripIds }
    }
  };
  
  console.log('[Sync][uuid] UUID remapping summary:', summary);
  
  return {
    vehicles: remappedVehicles,
    fillups: remappedFillups,
    maintenance: remappedMaintenance,
    tripEstimates: remappedTripEstimates,
    summary
  };
}

export const cloudSyncService = {
  /**
   * Validate if a string is a valid UUID (any version)
   * Service method wrapper for the standalone isValidUuid function
   * @param {string} value - Value to validate
   * @returns {boolean} True if valid UUID (any version)
   */
  isValidUuid(value) {
    return isValidUuid(value);
  },

  /**
   * Check if user is online
   */
  isOnline() {
    return navigator.onLine;
  },

  /**
   * Get the current user ID from Supabase
   */
  async getUserId() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if local data exists
   */
  hasLocalData() {
    const vehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
    const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
    const maintenance = JSON.parse(localStorage.getItem('fueltracker-maintenance-entries-v3') || '[]');
    const tripEstimates = JSON.parse(localStorage.getItem('fueltracker-trip-estimates-v2') || '[]');
    
    return {
      hasData: vehicles.length > 0 || fillups.length > 0 || maintenance.length > 0 || tripEstimates.length > 0,
      counts: {
        vehicles: vehicles.length,
        fillups: fillups.length,
        maintenance: maintenance.length,
        tripEstimates: tripEstimates.length
      }
    };
  },

  /**
   * Get local data summary
   */
  getLocalDataSummary() {
    const vehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
    const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
    const maintenance = JSON.parse(localStorage.getItem('fueltracker-maintenance-entries-v3') || '[]');
    const tripEstimates = JSON.parse(localStorage.getItem('fueltracker-trip-estimates-v2') || '[]');
    
    return {
      hasLocalData: vehicles.length > 0 || fillups.length > 0 || maintenance.length > 0 || tripEstimates.length > 0,
      localCounts: {
        vehicles: vehicles.length,
        fillups: fillups.length,
        maintenance: maintenance.length,
        tripEstimates: tripEstimates.length
      }
    };
  },

  /**
   * Get cloud data summary for a user
   */
  async getCloudDataSummary(userId) {
    try {
      const [vehiclesResult, fillupsResult, maintenanceResult, tripEstimatesResult] = await Promise.all([
        supabase.from('vehicles').select('id').eq('user_id', userId),
        supabase.from('fillups').select('id').eq('user_id', userId),
        supabase.from('maintenance').select('id').eq('user_id', userId),
        supabase.from('trip_estimates').select('id').eq('user_id', userId)
      ]);

      const vehicles = vehiclesResult.data || [];
      const fillups = fillupsResult.data || [];
      const maintenance = maintenanceResult.data || [];
      const tripEstimates = tripEstimatesResult.data || [];

      return {
        hasCloudData: vehicles.length > 0 || fillups.length > 0 || maintenance.length > 0 || tripEstimates.length > 0,
        cloudCounts: {
          vehicles: vehicles.length,
          fillups: fillups.length,
          maintenance: maintenance.length,
          tripEstimates: tripEstimates.length
        }
      };
    } catch (error) {
      return {
        hasCloudData: false,
        cloudCounts: {
          vehicles: 0,
          fillups: 0,
          maintenance: 0,
          tripEstimates: 0
        }
      };
    }
  },

  /**
   * Get sync status (both local and cloud)
   */
  async getSyncStatus(userId) {
    const localSummary = this.getLocalDataSummary();
    const cloudSummary = await this.getCloudDataSummary(userId);
    const detailedDiff = await this.getDetailedSyncDiff(userId);
    
    return {
      ...localSummary,
      ...cloudSummary,
      detailedDiff
    };
  },

  /**
   * Upload local data to cloud
   * @param {string} userId - User ID
   * @param {Object} options - Options object
   * @param {boolean} options.silent - If true, no modal or success messages (for background sync)
   */
  async uploadLocalDataToCloud(userId, options = {}) {
    const { silent = false } = options;
    console.log(`[Sync][upload] Starting ${silent ? 'silent' : 'manual'} upload to cloud`);
    const result = {
      success: false,
      action: 'upload',
      message: '',
      details: [],
      counts: {
        vehicles: 0,
        fillups: 0,
        maintenance: 0,
        tripEstimates: 0
      },
      uuidSummary: null,
      totalUploaded: 0
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        result.message = 'Not authenticated';
        result.details.push('User authentication check failed');
        return result;
      }

      result.details.push(`Authenticated as user: ${userId}`);

      const vehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
      const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
      const maintenance = JSON.parse(localStorage.getItem('fueltracker-maintenance-entries-v3') || '[]');
      const tripEstimates = JSON.parse(localStorage.getItem('fueltracker-trip-estimates-v2') || '[]');

      result.details.push(`Local records found: ${vehicles.length} vehicles, ${fillups.length} fillups, ${maintenance.length} maintenance, ${tripEstimates.length} trips`);

      // Backfill stable keys for vehicles BEFORE remapping (to preserve identity)
      const vehiclesWithStableKeys = backfillStableKeys(vehicles);

      // Backfill stable keys for fillups BEFORE remapping (to preserve identity)
      const fillupsWithStableKeys = backfillStableKeysForFillups(fillups);

      // Fetch existing cloud vehicles for deduplication (filter out deleted records)
      const { data: existingCloudVehicles, error: cloudVehiclesError } = await supabase.from('vehicles').select('*').eq('user_id', userId).is('deleted_at', null);
      const { data: existingFillups, error: cloudFillupsError } = await supabase.from('fillups').select('*').eq('user_id', userId).is('deleted_at', null);
      const { data: existingMaintenance, error: cloudMaintenanceError } = await supabase.from('maintenance').select('*').eq('user_id', userId).is('deleted_at', null);
      const { data: existingTripEstimates, error: cloudTripsError } = await supabase.from('trip_estimates').select('*').eq('user_id', userId).is('deleted_at', null);
      
      if (cloudVehiclesError) result.details.push(`Cloud vehicles fetch failed: ${cloudVehiclesError.message}`);
      if (cloudFillupsError) result.details.push(`Cloud fillups fetch failed: ${cloudFillupsError.message}`);
      if (cloudMaintenanceError) result.details.push(`Cloud maintenance fetch failed: ${cloudMaintenanceError.message}`);
      if (cloudTripsError) result.details.push(`Cloud trips fetch failed: ${cloudTripsError.message}`);

      result.details.push(`Cloud records found: ${existingCloudVehicles?.length || 0} vehicles, ${existingFillups?.length || 0} fillups, ${existingMaintenance?.length || 0} maintenance, ${existingTripEstimates?.length || 0} trips`);

      // Log exact vehicle shapes for debugging
      console.log('[Sync][upload] Local vehicle shapes:');
      vehiclesWithStableKeys.forEach(v => {
        console.log(`[Sync][vehicle] Local vehicle candidate: id=${v.id}, stableKey=${v.stableKey}, name=${v.name}, stable_key=${v.stable_key}, tankCapacity=${v.tankCapacity}, tank_capacity=${v.tank_capacity}`);
      });
      console.log('[Sync][upload] Cloud vehicle shapes:');
      existingCloudVehicles?.forEach(v => {
        console.log(`[Sync][vehicle] Cloud vehicle candidate: id=${v.id}, stableKey=${v.stableKey}, stable_key=${v.stable_key}, name=${v.name}, tankCapacity=${v.tankCapacity}, tank_capacity=${v.tank_capacity}`);
      });

      // Match local vehicles to cloud vehicles BEFORE remapping (using original IDs)
      const { matches, unmatchedLocal, unmatchedCloud } = matchVehicles(vehiclesWithStableKeys, existingCloudVehicles || []);
      
      console.log(`[Sync][upload] Vehicle matching: ${matches.size} matched, ${unmatchedLocal.length} unmatched local, ${unmatchedCloud.length} unmatched cloud`);

      // Fail-safe guard: if matching collapsed unexpectedly, use fingerprint fallback
      if (matches.size === 0 && vehiclesWithStableKeys.length > 0 && existingCloudVehicles?.length > 0) {
        console.log('[Sync][upload] WARNING: Stable-key matching returned zero matches with existing cloud data');
        console.log('[Sync][upload] Falling back to fingerprint matching for safety');
        
        // Try fingerprint matching as fallback with normalization
        for (const localVehicle of vehiclesWithStableKeys) {
          const normalizedLocal = normalizeVehicleForMatch(localVehicle, 'local');
          const localFingerprint = generateVehicleFingerprint(normalizedLocal);
          
          for (const cloudVehicle of existingCloudVehicles) {
            const normalizedCloud = normalizeVehicleForMatch(cloudVehicle, 'cloud');
            const cloudFingerprint = generateVehicleFingerprint(normalizedCloud);
            
            console.log(`[Sync][upload] Fallback comparison: local fingerprint=${localFingerprint}, cloud fingerprint=${cloudFingerprint}`);
            
            if (localFingerprint === cloudFingerprint) {
              console.log(`[Sync][upload] Fallback matched local vehicle ${localVehicle.id} to cloud vehicle ${cloudVehicle.id} by fingerprint`);
              matches.set(localVehicle.id, cloudVehicle.id);
              break;
            }
          }
        }
        
        console.log(`[Sync][upload] Fallback matching result: ${matches.size} matched by fingerprint`);
        
        // If still zero matches after fallback, abort to prevent duplicates
        if (matches.size === 0) {
          console.log('[Sync][upload] ERROR: Both stable-key and fingerprint matching returned zero matches');
          console.log('[Sync][upload] Aborting upload to prevent duplicate data creation');
          result.success = false;
          result.message = 'Upload aborted: Vehicle matching failed. This may indicate data corruption or schema mismatch.';
          result.details.push('Matching failed: No vehicles could be matched between local and cloud data.');
          result.details.push('Upload was aborted to prevent duplicate data creation.');
          result.details.push(`Local vehicles: ${vehiclesWithStableKeys.length}, Cloud vehicles: ${existingCloudVehicles.length}`);
          return result;
        }
      }

      // Remap legacy IDs to UUIDs AFTER matching (preserve matched cloud IDs)
      const { vehicles: remappedVehicles, fillups: remappedFillups, maintenance: remappedMaintenance, tripEstimates: remappedTripEstimates, summary } = remapLegacyIds(vehiclesWithStableKeys, fillupsWithStableKeys, maintenance, tripEstimates);
      result.uuidSummary = summary;
      result.details.push(`UUID remapping: ${summary.preservedUuids} preserved, ${summary.regeneratedIds} regenerated, ${summary.remappedForeignKeys} foreign keys remapped`);

      // Build mapping from remapped local IDs to cloud IDs for upload
      const remappedToCloudIdMap = new Map();
      vehicles.forEach((originalVehicle, idx) => {
        const originalId = originalVehicle.id;
        const remappedId = remappedVehicles[idx].id;
        const cloudId = matches.get(originalId);
        if (cloudId) {
          remappedToCloudIdMap.set(remappedId, cloudId);
        }
      });

      // Detect if there are any changes to upload
      const localDataSummary = {
        vehicles: vehiclesWithStableKeys,
        fillups: fillupsWithStableKeys,
        maintenance: remappedMaintenance,
        tripEstimates: remappedTripEstimates
      };
      
      // Filter out deleted records from cloud data for change detection
      const cloudDataSummary = {
        vehicles: existingCloudVehicles || [],
        fillups: existingFillups || [],
        maintenance: existingMaintenance || [],
        tripEstimates: existingTripEstimates || []
      };
      
      const changeDetection = detectChanges(localDataSummary, cloudDataSummary);
      
      if (!changeDetection.hasChanges) {
        console.log('[Sync][upload] No changes detected');
        console.log('[Sync][upload] Nothing to upload');
        result.success = true;
        result.message = 'Nothing to upload. Cloud is already up to date.';
        result.details.push('No new or changed records detected');
        return result;
      }
      
      console.log(`[Sync][upload] Changes detected: ${changeDetection.changeType} (${changeDetection.newVehicles} new vehicles, ${changeDetection.newFillups} new fillups, ${changeDetection.updatedVehicles} updated vehicles, ${changeDetection.deletedVehicles} deleted vehicles)`);

      // Sync tombstones to cloud before uploading new/updated records
      const vehicleTombstoneSync = await syncTombstonesToCloud(userId, vehiclesWithStableKeys, 'vehicles');
      const fillupTombstoneSync = await syncTombstonesToCloud(userId, remappedFillups, 'fillups');
      const maintenanceTombstoneSync = await syncTombstonesToCloud(userId, remappedMaintenance, 'maintenance');
      const tripTombstoneSync = await syncTombstonesToCloud(userId, remappedTripEstimates, 'trip_estimates');
      
      result.details.push(`Tombstone sync: ${vehicleTombstoneSync.synced} vehicles, ${fillupTombstoneSync.synced} fillups, ${maintenanceTombstoneSync.synced} maintenance, ${tripTombstoneSync.synced} trips`);

      let vehicleErrors = 0;
      let fillupErrors = 0;
      let fillupSkipped = 0;
      let fillupSkippedById = 0;
      let fillupSkippedByStableKey = 0;
      let fillupSkippedByFallback = 0;
      let fillupComputedTotal = 0;
      let maintenanceErrors = 0;
      let tripErrors = 0;
      let vehicleUpdates = 0;
      let vehicleInserts = 0;
      let vehicleSkipped = 0;

      // Build vehicle ID map for fillup normalization (use matched cloud IDs)
      const vehicleIdMap = new Map();
      remappedToCloudIdMap.forEach((cloudId, remappedLocalId) => {
        vehicleIdMap.set(remappedLocalId, cloudId);
      });

      // Upload vehicles with deduplication
      for (const remappedVehicle of remappedVehicles) {
        const matchedCloudId = remappedToCloudIdMap.get(remappedVehicle.id);
        
        if (matchedCloudId) {
          // Vehicle already exists in cloud - check if update is needed
          console.log(`[Sync][upload] Checking vehicle ${remappedVehicle.id} -> cloud ${matchedCloudId} for changes`);
          
          // Fetch current cloud vehicle to compare fields
          const { data: cloudVehicle, error: fetchError } = await supabase
            .from('vehicles')
            .select('*')
            .eq('id', matchedCloudId)
            .single();
          
          if (fetchError) {
            vehicleErrors++;
            result.details.push(`Vehicle fetch failed (${remappedVehicle.id}): ${fetchError.message}`);
            continue;
          }
          
          // Compare persisted fields
          const hasChanges = 
            remappedVehicle.name !== cloudVehicle.name ||
            (remappedVehicle.make || null) !== cloudVehicle.make ||
            (remappedVehicle.model || null) !== cloudVehicle.model ||
            (remappedVehicle.year || null) !== cloudVehicle.year ||
            (remappedVehicle.fuelType || null) !== cloudVehicle.fuel_type ||
            (remappedVehicle.tankCapacity || null) !== cloudVehicle.tank_capacity ||
            (remappedVehicle.licensePlate || null) !== cloudVehicle.license_plate ||
            remappedVehicle.stableKey !== cloudVehicle.stable_key;
          
          if (!hasChanges) {
            console.log(`[Sync][upload] Skipping unchanged vehicle ${remappedVehicle.id}`);
            vehicleSkipped++;
            continue;
          }
          
          // Update vehicle with changes
          console.log(`[Sync][upload] Updating existing vehicle ${remappedVehicle.id} -> cloud ${matchedCloudId}`);
          const { error } = await supabase.from('vehicles').update({
            name: remappedVehicle.name,
            make: remappedVehicle.make || null,
            model: remappedVehicle.model || null,
            year: remappedVehicle.year || null,
            fuel_type: remappedVehicle.fuelType || null,
            tank_capacity: remappedVehicle.tankCapacity || null,
            license_plate: remappedVehicle.licensePlate || null,
            stable_key: remappedVehicle.stableKey
          }).eq('id', matchedCloudId);
          
          if (error) {
            vehicleErrors++;
            result.details.push(`Vehicle update failed (${remappedVehicle.id}): ${error.message} (code: ${error.code})`);
          } else {
            vehicleUpdates++;
            result.counts.vehicles++;
          }
        } else {
          // New vehicle - insert it
          console.log(`[Sync][upload] Inserting new vehicle ${remappedVehicle.id}`);
          const { error } = await supabase.from('vehicles').insert({
            id: remappedVehicle.id,
            user_id: userId,
            name: remappedVehicle.name,
            make: remappedVehicle.make || null,
            model: remappedVehicle.model || null,
            year: remappedVehicle.year || null,
            fuel_type: remappedVehicle.fuelType || null,
            tank_capacity: remappedVehicle.tankCapacity || null,
            license_plate: remappedVehicle.licensePlate || null,
            stable_key: remappedVehicle.stableKey,
            created_at: new Date().toISOString()
          });
          
          if (error) {
            vehicleErrors++;
            result.details.push(`Vehicle insert failed (${remappedVehicle.id}): ${error.message} (code: ${error.code})`);
            console.log(`[Sync][upload] ERROR: Vehicle insert failed for ${remappedVehicle.id}, aborting upload to prevent foreign key errors`);
            result.success = false;
            result.message = 'Upload aborted: Vehicle insert failed. This may indicate a schema mismatch.';
            result.details.push('Upload was aborted to prevent cascading foreign key errors.');
            return result;
          } else {
            vehicleInserts++;
            result.counts.vehicles++;
            
            // Verify the inserted row from Supabase
            const { data: insertedRow, error: verifyError } = await supabase
              .from('vehicles')
              .select('id, user_id, name, make, model, year, fuel_type, tank_capacity, license_plate, stable_key, created_at, deleted_at')
              .eq('id', remappedVehicle.id)
              .single();
            
            console.log('[Sync][vehicle] Verified inserted cloud vehicle:', insertedRow, verifyError);
          }
        }
      }

      // Upload fillups with normalization and deduplication
      if (remappedFillups.length > 0) {
        const existingFillupIds = new Set(existingFillups?.map(f => f.id) || []);
        const existingFillupStableKeys = new Map(); // stable_key -> fillup
        existingFillups?.forEach(f => {
          if (f.stable_key) {
            existingFillupStableKeys.set(f.stable_key, f);
          }
        });
        
        for (const fillup of remappedFillups) {
          // First try to match by stable_key
          if (fillup.stableKey && existingFillupStableKeys.has(fillup.stableKey)) {
            const existingFillup = existingFillupStableKeys.get(fillup.stableKey);
            console.log(`[Sync][upload] Skipping existing fillup ${fillup.id} (by stable_key ${fillup.stableKey}, matches cloud ${existingFillup.id})`);
            fillupSkipped++;
            fillupSkippedByStableKey++;
            continue;
          }
          
          // Skip if fillup already exists in cloud (by ID)
          if (existingFillupIds.has(fillup.id)) {
            console.log(`[Sync][upload] Skipping existing fillup ${fillup.id} (by ID)`);
            fillupSkipped++;
            fillupSkippedById++;
            continue;
          }
          
          // Fallback duplicate detection for historical bad data
          const { isDuplicate, existingId } = detectDuplicateFillupByFields(fillup, existingFillups || []);
          if (isDuplicate) {
            console.log(`[Sync][upload] Skipping duplicate fillup ${fillup.id} (fallback detection, matches existing ${existingId})`);
            fillupSkipped++;
            fillupSkippedByFallback++;
            continue;
          }
          
          const { normalized, skipped, reason, computedTotal } = normalizeFillupForCloud(fillup, vehicleIdMap);
          
          if (skipped) {
            fillupSkipped++;
            result.details.push(`Fillup skipped (${fillup.id}): ${reason}`);
            continue;
          }
          
          if (computedTotal) {
            fillupComputedTotal++;
          }
          
          const { error } = await supabase.from('fillups').upsert({
            ...normalized,
            stable_key: fillup.stableKey,
            user_id: userId
          });
          if (error) {
            fillupErrors++;
            console.error('[Sync][upload] Fillup insert failed', {
              fillupId: fillup.id,
              stableKey: fillup.stableKey,
              payload: normalized,
              error: {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
              }
            });
            result.details.push(`Fillup upload failed (${fillup.id}): ${error.message} (code: ${error.code})`);
          } else {
            result.counts.fillups++;
            console.log(`[Sync][upload] Uploaded fillup ${fillup.id} with stable_key ${fillup.stableKey}`);
          }
        }
        
        result.details.push(`Fillup deduplication: ${fillupSkippedByStableKey} skipped by stable_key, ${fillupSkippedById} skipped by ID, ${fillupSkippedByFallback} skipped by fallback detection`);
      }

      // Upload maintenance with deduplication
      if (remappedMaintenance.length > 0) {
        const existingMaintenanceIds = new Set(existingMaintenance?.map(m => m.id) || []);
        
        for (const entry of remappedMaintenance) {
          // Skip if maintenance already exists in cloud
          if (existingMaintenanceIds.has(entry.id)) {
            console.log(`[Sync][upload] Skipping existing maintenance ${entry.id}`);
            continue;
          }
          
          const { error } = await supabase.from('maintenance').upsert({
            id: entry.id,
            user_id: userId,
            vehicle_id: entry.vehicleId,
            date: entry.date || new Date().toISOString().split('T')[0],
            type: entry.type || null,
            description: entry.description || null,
            cost: entry.cost || null,
            odometer: entry.odometer || null,
            next_due_date: entry.nextDueDate || null,
            next_due_odometer: entry.nextDueOdometer || null,
            created_at: entry.createdAt || new Date().toISOString()
          });
          if (error) {
            maintenanceErrors++;
            result.details.push(`Maintenance upload failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.maintenance++;
          }
        }
      }

      // Upload trip estimates with deduplication
      if (remappedTripEstimates.length > 0) {
        const existingTripIds = new Set(existingTripEstimates?.map(t => t.id) || []);
        
        for (const estimate of remappedTripEstimates) {
          // Skip if trip estimate already exists in cloud
          if (existingTripIds.has(estimate.id)) {
            console.log(`[Sync][upload] Skipping existing trip estimate ${estimate.id}`);
            continue;
          }
          
          const { error } = await supabase.from('trip_estimates').upsert({
            id: estimate.id,
            user_id: userId,
            vehicle_id: estimate.vehicleId,
            name: estimate.name || null,
            distance: estimate.distance || null,
            notes: estimate.notes || null,
            created_at: estimate.createdAt || new Date().toISOString()
          });
          if (error) {
            tripErrors++;
            result.details.push(`Trip estimate upload failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.tripEstimates++;
          }
        }
      }

      const totalErrors = vehicleErrors + fillupErrors + maintenanceErrors + tripErrors;
      const totalRecords = result.counts.vehicles + result.counts.fillups + result.counts.maintenance + result.counts.tripEstimates;
      const totalSkipped = fillupSkipped;

      // Fetch cloud counts after upload for verification
      const { data: cloudVehiclesAfter, error: vehiclesAfterError } = await supabase.from('vehicles').select('id').eq('user_id', userId).is('deleted_at', null);
      const { data: cloudFillupsAfter, error: fillupsAfterError } = await supabase.from('fillups').select('id').eq('user_id', userId).is('deleted_at', null);
      const { data: cloudMaintenanceAfter, error: maintenanceAfterError } = await supabase.from('maintenance').select('id').eq('user_id', userId).is('deleted_at', null);
      const { data: cloudTripsAfter, error: tripsAfterError } = await supabase.from('trip_estimates').select('id').eq('user_id', userId).is('deleted_at', null);

      // Upload summary logging
      console.log(`[Sync][upload] Upload summary:`);
      console.log(`  - Cloud counts BEFORE: ${existingCloudVehicles?.length || 0} vehicles, ${existingFillups?.length || 0} fillups, ${existingMaintenance?.length || 0} maintenance, ${existingTripEstimates?.length || 0} trips`);
      console.log(`  - Local counts BEFORE: ${vehicles.length} vehicles, ${fillups.length} fillups, ${maintenance.length} maintenance, ${tripEstimates.length} trips`);
      console.log(`  - Matched vehicles: ${matches.size}`);
      console.log(`  - New vehicles: ${vehicleInserts}`);
      console.log(`  - Updated vehicles: ${vehicleUpdates}`);
      console.log(`  - Skipped vehicles (unchanged): ${vehicleSkipped}`);
      console.log(`  - New fillups: ${result.counts.fillups}`);
      console.log(`  - Skipped fillups by stable_key: ${fillupSkippedByStableKey || 0}`);
      console.log(`  - Skipped fillups by ID: ${fillupSkippedById || 0}`);
      console.log(`  - Skipped fillups by fallback: ${fillupSkippedByFallback || 0}`);
      console.log(`  - Total skipped fillups: ${fillupSkipped}`);
      console.log(`  - New maintenance: ${result.counts.maintenance}`);
      console.log(`  - New trip estimates: ${result.counts.tripEstimates}`);
      console.log(`  - Total skipped records: ${totalSkipped}`);
      console.log(`  - Errors: ${totalErrors}`);
      console.log(`  - Total records uploaded: ${totalRecords}`);
      console.log(`  - Cloud counts AFTER: ${cloudVehiclesAfter?.length || 0} vehicles, ${cloudFillupsAfter?.length || 0} fillups, ${cloudMaintenanceAfter?.length || 0} maintenance, ${cloudTripsAfter?.length || 0} trips`);
      console.log(`  - Cloud count changes: +${(cloudVehiclesAfter?.length || 0) - (existingCloudVehicles?.length || 0)} vehicles, +${(cloudFillupsAfter?.length || 0) - (existingFillups?.length || 0)} fillups, +${(cloudMaintenanceAfter?.length || 0) - (existingMaintenance?.length || 0)} maintenance, +${(cloudTripsAfter?.length || 0) - (existingTripEstimates?.length || 0)} trips`);

      if (totalErrors === 0 && totalRecords > 0) {
        result.success = true;
        result.totalUploaded = totalRecords;
        result.message = `Upload complete. ${totalRecords} records saved to your cloud account.`;
        result.details.push(`Successfully uploaded: ${vehicleInserts} new vehicles, ${vehicleUpdates} updated vehicles, ${result.counts.fillups} fillups, ${result.counts.maintenance} maintenance, ${result.counts.tripEstimates} trips`);
        result.details.push(`Skipped ${totalSkipped} existing records (${vehicleSkipped} unchanged vehicles, ${fillupSkipped} fillups)`);
        if (fillupComputedTotal > 0) {
          result.details.push(`Fillup normalization: ${fillupComputedTotal} totalCost values computed from liters * pricePerLiter`);
        }
        if (fillupSkipped > 0) {
          result.details.push(`Fillup deduplication: ${fillupSkippedByStableKey} skipped by stable_key, ${fillupSkippedById} skipped by ID, ${fillupSkippedByFallback} skipped by fallback detection`);
        }
        localStorage.setItem(MIGRATION_DECISION_KEY, 'upload');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        // Set cloud synced flag to indicate local data is now in cloud
        localStorage.setItem(CLOUD_SYNCED_FLAG_KEY, new Date().toISOString());
        console.log('[Sync][upload] Upload successful, migration flags set');
      } else if (totalRecords > 0) {
        result.success = false;
        result.totalUploaded = totalRecords;
        result.message = `Upload partially succeeded. ${totalRecords} records uploaded, ${totalErrors} failed.`;
        result.details.push(`Partial success: ${vehicleInserts} new vehicles, ${vehicleUpdates} updated vehicles, ${totalRecords} uploaded, ${totalErrors} failed`);
        result.details.push(`Skipped ${totalSkipped} existing records (${vehicleSkipped} unchanged vehicles, ${fillupSkipped} fillups)`);
        if (fillupComputedTotal > 0) {
          result.details.push(`Fillup normalization: ${fillupComputedTotal} totalCost values computed from liters * pricePerLiter`);
        }
        if (fillupSkipped > 0) {
          result.details.push(`Fillup deduplication: ${fillupSkippedByStableKey} skipped by stable_key, ${fillupSkippedById} skipped by ID, ${fillupSkippedByFallback} skipped by fallback detection`);
        }
        console.log('[Sync][upload] Upload partially succeeded with errors');
      } else if (totalSkipped > 0) {
        // No new records, only skipped existing records
        // But only treat as no-op if there were NO errors
        if (totalErrors === 0) {
          result.success = true;
          result.totalUploaded = 0;
          result.message = 'Nothing to upload. All records are already in sync.';
          result.details.push(`No new records to upload. Skipped ${totalSkipped} existing records (${vehicleSkipped} unchanged vehicles, ${fillupSkipped} fillups)`);
          if (fillupSkipped > 0) {
            result.details.push(`Fillup deduplication: ${fillupSkippedByStableKey} skipped by stable_key, ${fillupSkippedById} skipped by ID, ${fillupSkippedByFallback} skipped by fallback detection`);
          }
          console.log('[Sync][upload] No changes detected, nothing to upload');
        } else {
          // There were errors even though no records were uploaded
          result.success = false;
          result.totalUploaded = 0;
          result.message = `Sync failed. ${totalErrors} error${totalErrors !== 1 ? 's' : ''} occurred during upload.`;
          result.details.push(`No records uploaded, but ${totalErrors} error${totalErrors !== 1 ? 's' : ''} occurred`);
          result.details.push(`Skipped ${totalSkipped} existing records (${vehicleSkipped} unchanged vehicles, ${fillupSkipped} fillups)`);
          if (fillupSkipped > 0) {
            result.details.push(`Fillup deduplication: ${fillupSkippedByStableKey} skipped by stable_key, ${fillupSkippedById} skipped by ID, ${fillupSkippedByFallback} skipped by fallback detection`);
          }
          console.log('[Sync][upload] Upload failed with errors, no records uploaded');
        }
      } else {
        result.success = false;
        result.totalUploaded = 0;
        result.message = 'Upload failed. No records were saved to the cloud.';
        result.details.push('All upload operations failed or no data to upload');
        result.details.push(`Skipped ${totalSkipped} existing records`);
        if (fillupSkipped > 0) {
          result.details.push(`Fillup normalization: ${fillupSkipped} fillups skipped due to missing required fields`);
        }
        console.log('[Sync][upload] Upload failed - no records saved');
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = 'Upload failed due to an unexpected error.';
      result.details.push(`Exception: ${error.message}`);
      console.error('[Sync][upload] Upload exception:', error);
      return result;
    }
  },

  /**
   * Download cloud data to local (overwrites local)
   */
  async downloadCloudDataToLocal(userId) {
    console.log('[Sync][download] Starting download from cloud');
    const result = {
      success: false,
      action: 'download',
      message: '',
      details: [],
      counts: {
        vehicles: 0,
        fillups: 0,
        maintenance: 0,
        tripEstimates: 0
      }
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        result.message = 'Not authenticated';
        result.details.push('User authentication check failed');
        return result;
      }

      result.details.push(`Authenticated as user: ${userId}`);

      // Fetch vehicles (filter out deleted records)
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);
      
      if (vehiclesError) {
        result.details.push(`Vehicles fetch failed: ${vehiclesError.message} (code: ${vehiclesError.code})`);
      } else if (vehicles) {
        const mappedVehicles = vehicles.map(v => ({
          id: v.id,
          name: v.name,
          make: v.make,
          model: v.model,
          year: v.year,
          fuelType: v.fuel_type,
          tankCapacity: v.tank_capacity,
          licensePlate: v.license_plate,
          stableKey: v.stable_key,
          tyreSize: null
        }));
        localStorage.setItem('fueltracker-vehicles-v2', JSON.stringify(mappedVehicles));
        result.counts.vehicles = mappedVehicles.length;
      }

      // Fetch fillups (filter out deleted records)
      const { data: fillups, error: fillupsError } = await supabase
        .from('fillups')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: true });
      
      if (fillupsError) {
        result.details.push(`Fillups fetch failed: ${fillupsError.message} (code: ${fillupsError.code})`);
      } else if (fillups) {
        const mappedFillups = fillups.map(f => ({
          id: f.id,
          vehicleId: f.vehicle_id,
          date: f.date,
          odometer: f.odometer,
          liters: f.liters,
          pricePerLiter: f.price_per_liter,
          totalCost: f.total_cost,
          station: f.station,
          notes: f.notes,
          fullTank: f.full_tank,
          timestamp: f.created_at
        }));
        localStorage.setItem('fueltracker-fillups-v2', JSON.stringify(mappedFillups));
        result.counts.fillups = mappedFillups.length;
      }

      // Fetch maintenance (filter out deleted records)
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('date', { ascending: true });
      
      if (maintenanceError) {
        result.details.push(`Maintenance fetch failed: ${maintenanceError.message} (code: ${maintenanceError.code})`);
      } else if (maintenance) {
        const mappedMaintenance = maintenance.map(m => ({
          id: m.id,
          vehicleId: m.vehicle_id,
          date: m.date,
          type: m.type,
          description: m.description,
          cost: m.cost,
          odometer: m.odometer,
          nextDueDate: m.next_due_date,
          nextDueOdometer: m.next_due_odometer,
          createdAt: m.created_at
        }));
        localStorage.setItem('fueltracker-maintenance-entries-v3', JSON.stringify(mappedMaintenance));
        result.counts.maintenance = mappedMaintenance.length;
      }

      // Fetch trip estimates (filter out deleted records)
      const { data: tripEstimates, error: tripsError } = await supabase
        .from('trip_estimates')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);
      
      if (tripsError) {
        result.details.push(`Trip estimates fetch failed: ${tripsError.message} (code: ${tripsError.code})`);
      } else if (tripEstimates) {
        const mappedTrips = tripEstimates.map(t => ({
          id: t.id,
          vehicleId: t.vehicle_id,
          name: t.name,
          distance: t.distance,
          notes: t.notes,
          createdAt: t.created_at
        }));
        localStorage.setItem('fueltracker-trip-estimates-v2', JSON.stringify(mappedTrips));
        result.counts.tripEstimates = mappedTrips.length;
      }

      // Fetch app settings
      const { data: settings, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (settingsError) {
        result.details.push(`Settings fetch failed: ${settingsError.message} (code: ${settingsError.code})`);
      } else if (settings?.settings_json) {
        Object.entries(settings.settings_json).forEach(([key, value]) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (e) {
            result.details.push(`Failed to set ${key}: ${e.message}`);
          }
        });
      }

      const totalRecords = result.counts.vehicles + result.counts.fillups + result.counts.maintenance + result.counts.tripEstimates;
      const hasErrors = result.details.some(d => d.includes('failed'));

      if (!hasErrors && totalRecords > 0) {
        result.success = true;
        result.message = `Download complete. ${totalRecords} records loaded from your cloud account.`;
        result.details.push(`Successfully downloaded: ${result.counts.vehicles} vehicles, ${result.counts.fillups} fillups, ${result.counts.maintenance} maintenance, ${result.counts.tripEstimates} trips`);
        localStorage.setItem(MIGRATION_DECISION_KEY, 'download');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        // Set cloud synced flag to indicate local data is now in sync with cloud
        localStorage.setItem(CLOUD_SYNCED_FLAG_KEY, new Date().toISOString());
        console.log('[Sync][download] Download successful, migration flags set');
      } else if (totalRecords > 0) {
        result.success = false;
        result.message = `Download partially succeeded. ${totalRecords} records loaded, some operations failed.`;
        console.log('[Sync][download] Download partially succeeded with errors');
      } else {
        result.success = false;
        result.message = 'Download failed. No records were loaded from the cloud.';
        console.log('[Sync][download] Download failed - no records loaded');
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = 'Download failed due to an unexpected error.';
      result.details.push(`Exception: ${error.message}`);
      console.error('[Sync][download] Download exception:', error);
      return result;
    }
  },

  /**
   * Merge local data to cloud (dedupe by ID where possible)
   */
  async mergeLocalDataToCloud(userId) {
    console.log('[Sync][merge] Starting merge to cloud');
    const result = {
      success: false,
      action: 'merge',
      message: '',
      details: [],
      counts: {
        vehicles: 0,
        fillups: 0,
        maintenance: 0,
        tripEstimates: 0
      },
      uuidSummary: null
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        result.message = 'Not authenticated';
        result.details.push('User authentication check failed');
        return result;
      }

      result.details.push(`Authenticated as user: ${userId}`);

      // Get existing cloud data to avoid duplicates (include stable_key for matching, filter out deleted records)
      const { data: existingVehicles, error: vehiclesFetchError } = await supabase.from('vehicles').select('*').eq('user_id', userId).is('deleted_at', null);
      const { data: existingFillups, error: fillupsFetchError } = await supabase.from('fillups').select('id').eq('user_id', userId).is('deleted_at', null);
      const { data: existingMaintenance, error: maintenanceFetchError } = await supabase.from('maintenance').select('id').eq('user_id', userId).is('deleted_at', null);
      const { data: existingTripEstimates, error: tripsFetchError } = await supabase.from('trip_estimates').select('id').eq('user_id', userId).is('deleted_at', null);

      if (vehiclesFetchError) result.details.push(`Cloud vehicles fetch failed: ${vehiclesFetchError.message}`);
      if (fillupsFetchError) result.details.push(`Cloud fillups fetch failed: ${fillupsFetchError.message}`);
      if (maintenanceFetchError) result.details.push(`Cloud maintenance fetch failed: ${maintenanceFetchError.message}`);
      if (tripsFetchError) result.details.push(`Cloud trips fetch failed: ${tripsFetchError.message}`);

      const existingVehicleIds = new Set(existingVehicles?.map(v => v.id) || []);
      const existingFillupIds = new Set(existingFillups?.map(f => f.id) || []);
      const existingMaintenanceIds = new Set(existingMaintenance?.map(m => m.id) || []);
      const existingTripEstimateIds = new Set(existingTripEstimates?.map(t => t.id) || []);

      result.details.push(`Existing cloud records: ${existingVehicleIds.size} vehicles, ${existingFillupIds.size} fillups, ${existingMaintenanceIds.size} maintenance, ${existingTripEstimateIds.size} trips`);

      const vehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
      const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
      const maintenance = JSON.parse(localStorage.getItem('fueltracker-maintenance-entries-v3') || '[]');
      const tripEstimates = JSON.parse(localStorage.getItem('fueltracker-trip-estimates-v2') || '[]');

      result.details.push(`Local records to merge: ${vehicles.length} vehicles, ${fillups.length} fillups, ${maintenance.length} maintenance, ${tripEstimates.length} trips`);

      // Remap legacy IDs to UUIDs before merge
      const { vehicles: remappedVehicles, fillups: remappedFillups, maintenance: remappedMaintenance, tripEstimates: remappedTripEstimates, summary } = remapLegacyIds(vehicles, fillups, maintenance, tripEstimates);
      result.uuidSummary = summary;
      result.details.push(`UUID remapping: ${summary.preservedUuids} preserved, ${summary.regeneratedIds} regenerated, ${summary.remappedForeignKeys} foreign keys remapped`);

      // Backfill stable keys for vehicles
      const vehiclesWithStableKeys = backfillStableKeys(remappedVehicles);

      // Match local vehicles to cloud vehicles using stable_key or fingerprint
      const { matches, unmatchedLocal, unmatchedCloud } = matchVehicles(vehiclesWithStableKeys, existingVehicles || []);

      let vehicleErrors = 0;
      let fillupErrors = 0;
      let fillupSkipped = 0;
      let fillupComputedTotal = 0;
      let maintenanceErrors = 0;
      let tripErrors = 0;
      let skipped = 0;
      let vehicleUpdates = 0;
      let vehicleInserts = 0;

      // Build vehicle ID map for fillup normalization (use matched cloud IDs)
      const vehicleIdMap = new Map();
      matches.forEach((cloudId, localId) => {
        vehicleIdMap.set(localId, cloudId);
      });

      // Upload vehicles with deduplication (same logic as upload)
      for (const localVehicle of vehiclesWithStableKeys) {
        const matchedCloudId = matches.get(localVehicle.id);
        
        if (matchedCloudId) {
          // Vehicle already exists in cloud - skip (merge only adds new records)
          console.log(`[Sync][vehicle] Merge reused existing cloud vehicle ${localVehicle.id} -> ${matchedCloudId}`);
          skipped++;
        } else if (!existingVehicleIds.has(localVehicle.id)) {
          // New vehicle - insert it
          console.log(`[Sync][vehicle] Merge created new vehicle ${localVehicle.id}`);
          const { error } = await supabase.from('vehicles').insert({
            id: localVehicle.id,
            user_id: userId,
            name: localVehicle.name,
            make: localVehicle.make || null,
            model: localVehicle.model || null,
            year: localVehicle.year || null,
            fuel_type: localVehicle.fuelType || null,
            tank_capacity: localVehicle.tankCapacity || null,
            license_plate: localVehicle.licensePlate || null,
            stable_key: localVehicle.stableKey,
            created_at: new Date().toISOString()
          });
          
          if (error) {
            vehicleErrors++;
            result.details.push(`Vehicle insert failed (${localVehicle.id}): ${error.message} (code: ${error.code})`);
          } else {
            vehicleInserts++;
            result.counts.vehicles++;
          }
        } else {
          // Vehicle ID exists but no stable_key match - skip to avoid duplicates
          console.log(`[Sync][vehicle] Merge skipped duplicate vehicle ${localVehicle.id}`);
          skipped++;
        }
      }

      // Upload fillups (skip existing) with normalization
      for (const fillup of remappedFillups) {
        if (!existingFillupIds.has(fillup.id)) {
          const { normalized, skipped: fillupSkippedNorm, reason, computedTotal } = normalizeFillupForCloud(fillup, vehicleIdMap);
          
          if (fillupSkippedNorm) {
            fillupSkipped++;
            result.details.push(`Fillup skipped (${fillup.id}): ${reason}`);
            continue;
          }
          
          if (computedTotal) {
            fillupComputedTotal++;
          }
          
          const { error } = await supabase.from('fillups').upsert({
            ...normalized,
            user_id: userId
          });
          if (error) {
            fillupErrors++;
            result.details.push(`Fillup merge failed (${fillup.id}): ${error.message} (code: ${error.code})`);
          } else {
            result.counts.fillups++;
          }
        } else {
          skipped++;
        }
      }

      // Upload maintenance (skip existing)
      for (const entry of remappedMaintenance) {
        if (!existingMaintenanceIds.has(entry.id)) {
          const { error } = await supabase.from('maintenance').upsert({
            id: entry.id,
            user_id: userId,
            vehicle_id: entry.vehicleId,
            date: entry.date || new Date().toISOString().split('T')[0],
            type: entry.type || null,
            description: entry.description || null,
            cost: entry.cost || null,
            odometer: entry.odometer || null,
            next_due_date: entry.nextDueDate || null,
            next_due_odometer: entry.nextDueOdometer || null,
            created_at: entry.createdAt || new Date().toISOString()
          });
          if (error) {
            maintenanceErrors++;
            result.details.push(`Maintenance merge failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.maintenance++;
          }
        } else {
          skipped++;
        }
      }

      // Upload trip estimates (skip existing)
      for (const estimate of remappedTripEstimates) {
        if (!existingTripEstimateIds.has(estimate.id)) {
          const { error } = await supabase.from('trip_estimates').upsert({
            id: estimate.id,
            user_id: userId,
            vehicle_id: estimate.vehicleId,
            name: estimate.name || null,
            distance: estimate.distance || null,
            notes: estimate.notes || null,
            created_at: estimate.createdAt || new Date().toISOString()
          });
          if (error) {
            tripErrors++;
            result.details.push(`Trip estimate merge failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.tripEstimates++;
          }
        } else {
          skipped++;
        }
      }

      // Sync merged data back to local
      await this.downloadCloudDataToLocal(userId);

      const totalErrors = vehicleErrors + fillupErrors + maintenanceErrors + tripErrors;
      const totalMerged = result.counts.vehicles + result.counts.fillups + result.counts.maintenance + result.counts.tripEstimates;

      result.details.push(`Merge summary: ${totalMerged} new records merged, ${skipped} duplicates skipped, ${totalErrors} errors`);

      if (totalErrors === 0) {
        result.success = true;
        result.message = `Merge complete. ${totalMerged} new records merged, ${skipped} duplicates skipped.`;
        result.details.push(`Vehicle merge: ${vehicleInserts} new vehicles created, ${matches.size} existing vehicles reused`);
        if (fillupComputedTotal > 0) {
          result.details.push(`Fillup normalization: ${fillupComputedTotal} totalCost values computed from liters * pricePerLiter`);
        }
        if (fillupSkipped > 0) {
          result.details.push(`Fillup normalization: ${fillupSkipped} fillups skipped due to missing required fields`);
        }
        localStorage.setItem(MIGRATION_DECISION_KEY, 'merge');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        // Set cloud synced flag to indicate local data is now in sync with cloud
        localStorage.setItem(CLOUD_SYNCED_FLAG_KEY, new Date().toISOString());
        console.log('[Sync][merge] Merge successful, migration flags set');
      } else if (totalMerged > 0) {
        result.success = false;
        result.message = `Merge partially succeeded. ${totalMerged} records merged, ${totalErrors} failed.`;
        result.details.push(`Vehicle merge: ${vehicleInserts} new vehicles created, ${matches.size} existing vehicles reused`);
        if (fillupComputedTotal > 0) {
          result.details.push(`Fillup normalization: ${fillupComputedTotal} totalCost values computed from liters * pricePerLiter`);
        }
        if (fillupSkipped > 0) {
          result.details.push(`Fillup normalization: ${fillupSkipped} fillups skipped due to missing required fields`);
        }
        console.log('[Sync][merge] Merge partially succeeded with errors');
      } else {
        result.success = false;
        result.message = 'Merge failed. No records were merged.';
        if (fillupSkipped > 0) {
          result.details.push(`Fillup normalization: ${fillupSkipped} fillups skipped due to missing required fields`);
        }
        console.log('[Sync][merge] Merge failed - no records merged');
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = 'Merge failed due to an unexpected error.';
      result.details.push(`Exception: ${error.message}`);
      console.error('[Sync][merge] Merge exception:', error);
      return result;
    }
  },

  /**
   * Migrate existing localStorage data to Supabase on first login
   */
  async migrateData(userId) {
    const migrationComplete = localStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrationComplete) {
      return;
    }

    try {
      // Migrate vehicles
      const vehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
      if (vehicles.length > 0) {
        for (const vehicle of vehicles) {
          await supabase.from('vehicles').upsert({
            id: vehicle.id || uuidv4(),
            user_id: userId,
            name: vehicle.name,
            make: vehicle.make || null,
            model: vehicle.model || null,
            year: vehicle.year || null,
            fuel_type: vehicle.fuelType || null,
            tank_capacity: vehicle.tankCapacity || null,
            license_plate: vehicle.licensePlate || null,
            created_at: new Date().toISOString()
          });
        }
      }

      // Migrate fillups
      const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
      if (fillups.length > 0) {
        for (const fillup of fillups) {
          await supabase.from('fillups').upsert({
            id: fillup.id || uuidv4(),
            user_id: userId,
            vehicle_id: fillup.vehicleId,
            date: fillup.date || new Date().toISOString().split('T')[0],
            odometer: fillup.odometer,
            liters: fillup.liters,
            price_per_liter: fillup.pricePerLiter,
            total_cost: fillup.totalCost,
            station: fillup.station || null,
            notes: fillup.notes || null,
            full_tank: fillup.fullTank !== undefined ? fillup.fullTank : true,
            created_at: fillup.createdAt || new Date().toISOString()
          });
        }
      }

      // Migrate maintenance entries
      const maintenance = JSON.parse(localStorage.getItem('fueltracker-maintenance-entries-v3') || '[]');
      if (maintenance.length > 0) {
        for (const entry of maintenance) {
          await supabase.from('maintenance').upsert({
            id: entry.id || uuidv4(),
            user_id: userId,
            vehicle_id: entry.vehicleId,
            date: entry.date || new Date().toISOString().split('T')[0],
            type: entry.type || null,
            description: entry.description || null,
            cost: entry.cost || null,
            odometer: entry.odometer || null,
            next_due_date: entry.nextDueDate || null,
            next_due_odometer: entry.nextDueOdometer || null,
            created_at: entry.createdAt || new Date().toISOString()
          });
        }
      }

      // Migrate prices
      const prices = JSON.parse(localStorage.getItem('fueltracker-prices-v2') || '{}');
      if (Object.keys(prices).length > 0) {
        await supabase.from('prices').upsert({
          id: uuidv4(),
          user_id: userId,
          date: new Date().toISOString().split('T')[0],
          station: 'Default',
          fuel_type: 'mixed',
          price: JSON.stringify(prices),
          location: null,
          created_at: new Date().toISOString()
        });
      }

      // Migrate trip estimates
      const tripEstimates = JSON.parse(localStorage.getItem('fueltracker-trip-estimates-v2') || '[]');
      if (tripEstimates.length > 0) {
        for (const estimate of tripEstimates) {
          await supabase.from('trip_estimates').upsert({
            id: estimate.id || uuidv4(),
            user_id: userId,
            vehicle_id: estimate.vehicleId,
            name: estimate.name || null,
            distance: estimate.distance || null,
            notes: estimate.notes || null,
            created_at: estimate.createdAt || new Date().toISOString()
          });
        }
      }

      // Migrate app settings (theme, etc.)
      const settings = {};
      LOCALSTORAGE_KEYS.forEach(key => {
        if (key.includes('theme') || key.includes('stations')) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              settings[key] = JSON.parse(value);
            } catch {
              settings[key] = value;
            }
          }
        }
      });

      if (Object.keys(settings).length > 0) {
        await supabase.from('app_settings').upsert({
          id: uuidv4(),
          user_id: userId,
          settings_json: settings,
          updated_at: new Date().toISOString()
        });
      }

      // Always set migration flag, even if no data was migrated
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    } catch (error) {
      // Set migration flag even on error to prevent infinite loop
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      throw error;
    }
  },

  /**
   * Fetch all data from Supabase and update localStorage
   */
  async syncFromCloud(userId) {
    if (!this.isOnline()) {
      return;
    }

    try {
      // Fetch vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId);
      
      if (vehiclesError) {
      } else {
        const mappedVehicles = (vehicles || []).map(v => ({
          id: v.id,
          name: v.name,
          make: v.make,
          model: v.model,
          year: v.year,
          fuelType: v.fuel_type,
          tankCapacity: v.tank_capacity,
          licensePlate: v.license_plate,
          tyreSize: null
        }));
        localStorage.setItem('fueltracker-vehicles-v2', JSON.stringify(mappedVehicles));
      }

      // Fetch fillups
      const { data: fillups, error: fillupsError } = await supabase
        .from('fillups')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });
      
      if (fillupsError) {
      } else {
        const mappedFillups = (fillups || []).map(f => ({
          id: f.id,
          vehicleId: f.vehicle_id,
          date: f.date,
          odometer: f.odometer,
          liters: f.liters,
          pricePerLiter: f.price_per_liter,
          totalCost: f.total_cost,
          station: f.station,
          notes: f.notes,
          fullTank: f.full_tank,
          timestamp: f.created_at
        }));
        localStorage.setItem('fueltracker-fillups-v2', JSON.stringify(mappedFillups));
      }

      // Fetch maintenance
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true });
      
      if (maintenanceError) {
      } else {
        const mappedMaintenance = (maintenance || []).map(m => ({
          id: m.id,
          vehicleId: m.vehicle_id,
          date: m.date,
          type: m.type,
          description: m.description,
          cost: m.cost,
          odometer: m.odometer,
          nextDueDate: m.next_due_date,
          nextDueOdometer: m.next_due_odometer,
          createdAt: m.created_at
        }));
        localStorage.setItem('fueltracker-maintenance-entries-v3', JSON.stringify(mappedMaintenance));
      }

      // Fetch app settings - use maybeSingle to handle missing rows gracefully
      const { data: settings, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (settingsError) {
      } else if (settings?.settings_json) {
        Object.entries(settings.settings_json).forEach(([key, value]) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (e) {
          }
        });
      }
    } catch (error) {
    }
  },

  /**
   * Queue a change for sync when online
   */
  queueChange(operation, table, data) {
    try {
      const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
      queue.push({
        id: uuidv4(),
        operation,
        table,
        data,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
    }
  },

  /**
   * Process queued changes when online
   */
  async processQueue(userId) {
    if (!this.isOnline()) {
      return;
    }

    try {
      const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
      if (queue.length === 0) {
        return;
      }

      const processed = [];
      const failed = [];

      for (const item of queue) {
        try {
          if (item.table === 'vehicles') {
            const data = item.data;
            await supabase.from('vehicles').upsert({
              id: data.id || uuidv4(),
              user_id: userId,
              name: data.name,
              make: data.make || null,
              model: data.model || null,
              year: data.year || null,
              fuel_type: data.fuelType || null,
              tank_capacity: data.tankCapacity || null,
              license_plate: data.licensePlate || null
            });
          } else if (item.table === 'fillups') {
            const data = item.data;
            await supabase.from('fillups').upsert({
              id: data.id || uuidv4(),
              user_id: userId,
              vehicle_id: data.vehicleId,
              date: data.date,
              odometer: data.odometer,
              liters: data.liters,
              price_per_liter: data.pricePerLiter,
              total_cost: data.totalCost,
              station: data.station || null,
              notes: data.notes || null,
              full_tank: data.fullTank !== undefined ? data.fullTank : true
            });
          } else if (item.table === 'maintenance') {
            const data = item.data;
            await supabase.from('maintenance').upsert({
              id: data.id || uuidv4(),
              user_id: userId,
              vehicle_id: data.vehicleId,
              date: data.date,
              type: data.type || null,
              description: data.description || null,
              cost: data.cost || null,
              odometer: data.odometer || null,
              next_due_date: data.nextDueDate || null,
              next_due_odometer: data.nextDueOdometer || null
            });
          }
          processed.push(item.id);
        } catch (error) {
          failed.push(item);
        }
      }

      // Remove processed items from queue
      const remainingQueue = queue.filter(item => !processed.includes(item.id));
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
    } catch (error) {
    }
  },

  /**
   * Setup online sync listener (controlled, single instance)
   * @param {string} userId - User ID for sync
   * @param {Object} options - Sync options
   * @param {string} options.decision - Migration decision ('upload', 'download', 'merge', 'keep-local')
   */
  setupOnlineSyncListener(userId, options = {}) {
    // Remove existing listener if any
    this.removeOnlineSyncListener();

    const decision = options.decision || localStorage.getItem(MIGRATION_DECISION_KEY) || 'download';

    onlineListener = async () => {
      try {
        // Respect migration decision for online sync
        if (decision === 'keep-local') {
          // Only process queue if safe (uploading local changes, not overwriting)
          // For now, skip entirely to be safe
          return;
        }

        if (this.isOnline()) {
          await this.syncFromCloud(userId);
          await this.processQueue(userId);
        }
      } catch (error) {
      }
    };

    window.addEventListener('online', onlineListener);
  },

  /**
   * Remove online sync listener
   */
  removeOnlineSyncListener() {
    if (onlineListener) {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
  },

  /**
   * Initialize sync - called on app load
   * Returns sync status for UI to decide if migration modal is needed
   */
  async initialize() {
    if (initializationInProgress) return initializationPromise;

    const currentId = ++latestInitializationId;
    console.log(`[Sync][initialize] Starting sync initialization (ID: ${currentId})`);
    
    initializationInProgress = true;
    initializationPromise = (async () => {
      try {
        const userId = await this.getUserId();
        if (!userId) {
          console.log('[Sync][initialize] No user ID found, returning null');
          return null;
        }

        if (currentId !== latestInitializationId) return null;

        // --- LEGACY BACKFILL RULE ---
        console.log('[Sync][initialize] Running legacy metadata backfill');
        this.backfillMetadata();

        const migrationDecision = localStorage.getItem(MIGRATION_DECISION_KEY);
        const migrationComplete = localStorage.getItem(MIGRATION_FLAG_KEY);
        const countsMatchedNoConflict = localStorage.getItem(COUNTS_MATCHED_NO_CONFLICT_KEY);

        if (countsMatchedNoConflict && !migrationDecision) {
          const syncStatus = await this.getSyncStatus(userId);
          if (currentId !== latestInitializationId) return null;

          const countsMatch = (syncStatus.localCounts?.vehicles === syncStatus.cloudCounts?.vehicles && 
                         syncStatus.localCounts?.fillups === syncStatus.cloudCounts?.fillups);
          
          if (countsMatch) {
            this.setupOnlineSyncListener(userId, { decision: null });
            // Always fire outbox on startup – don't gate on the background lock
            if (this.isOnline()) await this.syncAfterMutation(userId);
            return null;
          } else {
            localStorage.removeItem(COUNTS_MATCHED_NO_CONFLICT_KEY);
            return await this.getSyncStatus(userId);
          }
        }

        if (migrationComplete === 'true' && migrationDecision) {
          if (migrationDecision === 'keep-local') {
            console.log('[Sync][initialize] Stored decision is keep-local — cloud writes DISABLED. Remove localStorage key "fueltracker-migration-decision" to re-enable.');
            return null;
          }
          this.setupOnlineSyncListener(userId, { decision: migrationDecision });
          // Always fire outbox on startup – don't gate on the background lock
          if (this.isOnline()) await this.syncAfterMutation(userId);
          return null;
        }

        // Only show modal if user action is genuinely required
        const syncStatus = await this.getSyncStatus(userId);
        if (currentId !== latestInitializationId) return null;

        // Don't show modal if:
        // - No local data and no cloud data (fresh start)
        // - No conflicts and counts match (already in sync)
        // - No conflicts and only local-only data (first-time user with local data, can auto-upload)
        const hasLocalData = syncStatus.hasLocalData;
        const hasCloudData = syncStatus.hasCloudData;
        const hasConflicts = syncStatus.detailedDiff?.conflicts?.length > 0;
        const countsMatch = (syncStatus.localCounts?.vehicles === syncStatus.cloudCounts?.vehicles && 
                           syncStatus.localCounts?.fillups === syncStatus.cloudCounts?.fillups);

        // Fresh start - no data anywhere
        if (!hasLocalData && !hasCloudData) {
          console.log('[Sync][initialize] Fresh start - no local or cloud data, skipping modal');
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          localStorage.setItem(MIGRATION_DECISION_KEY, 'keep-local');
          return null;
        }

        // Already in sync - no conflicts, counts match
        if (!hasConflicts && countsMatch) {
          console.log('[Sync][initialize] Already in sync - no conflicts, counts match, skipping modal');
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          localStorage.setItem(MIGRATION_DECISION_KEY, 'merge');
          this.setupOnlineSyncListener(userId, { decision: 'merge' });
          if (this.isOnline()) await this.syncAfterMutation(userId);
          return null;
        }

        // First-time user with local data only - can auto-upload without asking
        if (hasLocalData && !hasCloudData && !hasConflicts) {
          console.log('[Sync][initialize] First-time user with local data only - auto-uploading without modal');
          const uploadResult = await this.uploadLocalChanges(userId);
          if (uploadResult.success) {
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
            localStorage.setItem(MIGRATION_DECISION_KEY, 'upload');
            this.setupOnlineSyncListener(userId, { decision: 'upload' });
            return null;
          }
          // If upload fails, show modal for manual intervention
          console.log('[Sync][initialize] Auto-upload failed, showing modal for manual intervention');
        }

        // Show modal only if:
        // - Has conflicts (user must resolve)
        // - Both local and cloud data exist with differences
        // - Cloud data exists but no local data (user must choose download or start fresh)
        if (hasConflicts || (hasLocalData && hasCloudData) || (hasCloudData && !hasLocalData)) {
          console.log('[Sync][initialize] Showing modal - user action required');
          return syncStatus;
        }

        console.log('[Sync][initialize] No user action required, skipping modal');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        localStorage.setItem(MIGRATION_DECISION_KEY, 'keep-local');
        return null;
      } catch (error) {
        console.error('[Sync][initialize] Initialization failed:', error);
        return null;
      } finally {
        initializationInProgress = false;
        setTimeout(() => { if (!initializationInProgress) initializationPromise = null; }, 1000);
      }
    })();

    return initializationPromise;
  },

  /**
   * Backfill missing metadata (stableKey, updatedAt) for all local records
   */
  backfillMetadata() {
    const keys = [
      { localKey: 'fueltracker-vehicles-v2', entityKey: 'vehicles' },
      { localKey: 'fueltracker-fillups-v2', entityKey: 'fillups' }
    ];

    keys.forEach(k => {
      const records = JSON.parse(localStorage.getItem(k.localKey) || '[]');
      const { normalized, changed } = this.normalizeLegacyRecords(records);
      if (changed) {
        localStorage.setItem(k.localKey, JSON.stringify(normalized));
        console.log(`[Sync][backfill] Backfilled metadata for ${k.entityKey}`);
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entityKey: k.entityKey } }));
      }
    });
  },

  /**
   * Continue sync after migration decision
   */
  async continueSyncAfterDecision(userId, decision) {
    console.log('[Sync][initialize] Continuing sync after decision:', decision);
    console.log('[Sync][initialize] Decision value:', decision);
    console.log('[Sync][initialize] Action to perform:', decision);
    
    const result = {
      success: true,
      action: decision,
      message: '',
      details: []
    };

    try {
      // Setup online listener that respects this decision
      this.setupOnlineSyncListener(userId, { decision });

      switch (decision) {
        case 'upload':
          console.log('[Sync][initialize] Action: Upload local data to cloud');
          console.log('[Sync][initialize] Using new uploadLocalChanges logic');
          const uploadResult = await this.uploadLocalChanges(userId);
          result.success = uploadResult.success;
          result.message = uploadResult.message;
          result.details = uploadResult.details;
          result.summary = uploadResult.summary;
          result.counts = uploadResult.counts;
          result.totalUploaded = uploadResult.totalUploaded;
          console.log('[Sync][initialize] Upload action completed. Success:', result.success, 'Message:', result.message);
          break;

        case 'download':
          console.log('[Sync][initialize] Action: Download cloud data to local');
          console.log('[Sync][initialize] Using new replaceLocalWithCloud logic');
          const downloadResult = await this.replaceLocalWithCloud(userId);
          result.success = downloadResult.success;
          result.message = downloadResult.message;
          result.details = downloadResult.details;
          result.summary = downloadResult.summary;
          result.counts = downloadResult.counts;
          console.log('[Sync][initialize] Download action completed. Success:', result.success, 'Message:', result.message);
          break;

        case 'merge':
          console.log('[Sync][initialize] Action: Sync both sides (merge)');
          console.log('[Sync][initialize] Checking for conflicts in merge decision');
          
          // Fetch cloud data
          const { data: cloudFillups } = await supabase
            .from('fillups')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null);

          // Get local data
          const localFillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');

          // Compute diff
          const diff = this.computeFillupDiff(localFillups, cloudFillups || []);

          console.log('[Sync][initialize] Diff computed:', {
            localOnly: diff.localOnly.length,
            cloudOnly: diff.cloudOnly.length,
            bothChanged: diff.bothChanged.length,
            localDeleted: diff.localDeleted.length,
            cloudDeleted: diff.cloudDeleted.length
          });

          // If there are conflicts, return them for UI to handle
          if (diff.bothChanged.length > 0) {
            console.log('[Sync][initialize] Conflicts detected, returning for user resolution');
            result.needsResolution = true;
            result.conflicts = diff.bothChanged;
            result.nonConflicts = {
              localOnly: diff.localOnly,
              cloudOnly: diff.cloudOnly,
              localDeleted: diff.localDeleted,
              cloudDeleted: diff.cloudDeleted
            };
            result.message = `${diff.bothChanged.length} conflict${diff.bothChanged.length !== 1 ? 's' : ''} need resolution`;
            return result;
          }

          // No conflicts, proceed with automatic sync
          console.log('[Sync][initialize] No conflicts, proceeding with automatic sync');
          const mergeResult = await this.syncBothSides(userId);
          result.success = mergeResult.success;
          result.message = mergeResult.message;
          result.details = mergeResult.details;
          result.summary = mergeResult.summary;
          result.counts = mergeResult.counts;
          console.log('[Sync][initialize] Merge action completed. Success:', result.success, 'Message:', result.message);
          break;

        case 'keep-local':
          console.log('[Sync][initialize] Action: Keep local only (no sync)');
          // CRITICAL: Do NOT call syncFromCloud - preserve local data as-is
          // Do NOT overwrite localStorage from cloud
          // Skip queue processing to be safe
          console.log('[Sync][initialize] Keeping local only, no sync');
          result.message = 'Local data preserved. Cloud sync disabled.';
          console.log('[Sync][initialize] Keep-local action completed. Success:', result.success, 'Message:', result.message);
          break;

        default:
          console.log('[Sync][initialize] Unknown decision:', decision);
          result.success = false;
          result.message = 'Unknown migration decision.';
          break;
      }
    } catch (error) {
      console.error('[Sync][initialize] Continue sync after decision exception:', error);
      result.success = false;
      result.message = 'Sync continuation failed.';
      result.details.push(`Exception: ${error.message}`);
    }

    console.log('[Sync][initialize] Result modal to show - Title:', result.action, 'Message:', result.message);
    return result;
  },

  /**
   * Silent background sync for routine mutations
   * This function is called automatically after local mutations (create/update/delete)
   * It syncs changes to the cloud without showing any modal or success messages
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Sync result (silent, no UI)
   */
  /**
   * Process local mutations in FIFO order (Outbox Pattern)
   */
  async syncAfterMutation(userId) {
    if (backgroundSyncInProgress) return backgroundSyncPromise;

    backgroundSyncInProgress = true;
    backgroundSyncPromise = (async () => {
      try {
        console.log('[Sync][outbox] Starting outbox processing');
        
        // Use a consistent snapshot of the outbox to avoid race conditions
        const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
        
        // Find all pending or failed mutations in FIFO order (by id which is timestamp or updatedAt)
        const pendingMutations = fillups
          .filter(f => f.syncStatus === 'pending' || (f.syncStatus === 'failed' && (f.retryCount || 0) < 3))
          .sort((a, b) => (a.updatedAt || a.timestamp || 0) > (b.updatedAt || b.timestamp || 0) ? 1 : -1);

        if (pendingMutations.length === 0) {
          console.log('[Sync][outbox] No pending mutations');
          return { success: true, count: 0 };
        }

        console.log(`[Sync][outbox] Processing ${pendingMutations.length} mutations`);
        let successCount = 0;

        for (const record of pendingMutations) {
          if (!this.isOnline()) break;

          const result = await this.processSingleOutboxMutation(userId, record, 'fillups');
          if (result.success) successCount++;
          else {
            console.warn(`[Sync][outbox] Mutation failed for ${record.id}:`, result.error);
            // Sequential processing: stop on first failure to maintain FIFO integrity for dependent records
            break; 
          }
        }

        return { success: true, count: successCount };
      } catch (error) {
        console.error('[Sync][outbox] Critical failure:', error);
        return { success: false, error: error.message };
      } finally {
        backgroundSyncInProgress = false;
        backgroundSyncPromise = null;
      }
    })();

    return backgroundSyncPromise;
  },

  /**
   * Process a single outbox mutation with idempotency and lifecycle management
   */
  async processSingleOutboxMutation(userId, record, entityKey) {
    const tableMap = { fillups: 'fillups', vehicles: 'vehicles' };
    const table = tableMap[entityKey];

    // 1. Mark in_progress locally
    this.updateLocalSyncStatus(entityKey, record.id, { syncStatus: 'in_progress' });

    try {
      // 2. Backfill stable_key if missing
      if (!record.stableKey) {
        console.log(`[Sync][outbox] Backfilling missing stable_key for record ${record.id}`);
        const newStableKey = uuidv4();
        this.updateLocalSyncStatus(entityKey, record.id, { stableKey: newStableKey });
        record.stableKey = newStableKey;
      }

      // 3. Prepare payload
      const payload = this.mapLocalToCloud(record, entityKey);
      payload.user_id = userId;

      // 3. Replay-safe idempotency check (Identity + Metadata)
      // Check if cloud already has a newer or identical version
      const { data: existing, error: fetchError } = await supabase
        .from(table)
        .select('updated_at, deleted_at')
        .eq('stable_key', record.stableKey)
        .maybeSingle();

      if (fetchError) {
        console.error(`[Sync][outbox] Error fetching existing record ${record.stableKey}:`, fetchError);
      }

      if (existing) {
        const cloudUpdated = new Date(existing.updated_at).getTime();
        const localUpdated = new Date(record.updatedAt).getTime();
        const diffMs = cloudUpdated - localUpdated;

        console.log(`[Sync][reconcile] Comparing ${record.stableKey}:`, {
          localUpdatedAt: record.updatedAt,
          cloudUpdatedAt: existing.updated_at,
          diffMs,
          isCloudNewer: diffMs > 1000 // 1s buffer for clock skew
        });

        // No-resurrection rule: if cloud is already deleted, don't update unless this is also a delete
        if (existing.deleted_at && record.lastAction !== 'DELETE') {
          console.log(`[Sync][outbox] Idempotency: Cloud record ${record.stableKey} is already deleted. Keeping deleted.`);
          this.updateLocalSyncStatus(entityKey, record.id, { 
            syncStatus: 'synced', 
            deletedAt: existing.deleted_at,
            lastAction: 'DELETE' 
          });
          return { success: true };
        }

        // Newer cloud data wins (using 1s buffer for clock skew)
        if (diffMs > 1000) {
          console.log(`[Sync][outbox] Idempotency: Cloud has newer version for ${record.stableKey} by ${diffMs}ms. Triggering conflict.`);
          this.updateLocalSyncStatus(entityKey, record.id, { syncStatus: 'conflict' });
          return { success: false, error: 'conflict' };
        }
      }

      // 4. Perform Cloud Mutation
      // Strategy: filter by (user_id + stable_key); UPDATE if row exists, INSERT if not.
      // This avoids relying on DB-side on_conflict=stable_key which requires a unique constraint
      // that may not exist as a plain single-column index.
      let error;
      console.log(`[Sync][outbox] Operation: ${record.lastAction}, table: ${table}, stable_key: ${record.stableKey}`);
      console.log(`[Sync][outbox] Payload keys:`, Object.keys(payload));
      console.log(`[Sync][outbox] Payload:`, JSON.stringify(payload, null, 2));

      if (record.lastAction === 'DELETE') {
        // Tombstone: set deleted_at
        ({ error } = await supabase
          .from(table)
          .update({
            deleted_at: record.deletedAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stable_key', record.stableKey)
          .eq('user_id', userId));
        console.log(`[Sync][outbox] Tombstone sent for ${record.stableKey}, error:`, error?.message ?? 'none');
      } else {
        // Upsert: try UPDATE first; if no rows affected, INSERT
        const { data: updated, error: updateErr } = await supabase
          .from(table)
          .update(payload)
          .eq('stable_key', record.stableKey)
          .eq('user_id', userId)
          .select('stable_key');

        if (updateErr) {
          console.error(`[Sync][outbox] UPDATE failed for ${record.stableKey} (code: ${updateErr.code}):`, updateErr.message);
          error = updateErr;
        } else if (!updated || updated.length === 0) {
          // Row doesn't exist yet — INSERT
          console.log(`[Sync][outbox] No existing row for ${record.stableKey}, inserting`);
          const { error: insertErr } = await supabase
            .from(table)
            .insert(payload);
          if (insertErr) {
            console.error(`[Sync][outbox] INSERT failed for ${record.stableKey} (code: ${insertErr.code}):`, insertErr.message);
            error = insertErr;
          } else {
            console.log(`[Sync][outbox] INSERT succeeded for ${record.stableKey}`);
          }
        } else {
          console.log(`[Sync][outbox] UPDATE succeeded for ${record.stableKey}`);
        }
      }

      if (error) {
        console.error(`[Sync][outbox] Write error (code: ${error.code}):`, error.message);
        throw error;
      }

      // 5. Mark synced
      this.updateLocalSyncStatus(entityKey, record.id, { syncStatus: 'synced', retryCount: 0 });
      return { success: true };

    } catch (err) {
      const retryCount = (record.retryCount || 0) + 1;
      this.updateLocalSyncStatus(entityKey, record.id, { 
        syncStatus: 'failed', 
        retryCount,
        lastError: err.message
      });
      return { success: false, error: err.message };
    }
  },

  /**
   * Internal helper to update a single record's sync metadata locally
   */
  updateLocalSyncStatus(entityKey, id, updates) {
    const localKeyMap = { fillups: 'fueltracker-fillups-v2', vehicles: 'fueltracker-vehicles-v2' };
    const localKey = localKeyMap[entityKey];
    if (!localKey) return;

    const records = JSON.parse(localStorage.getItem(localKey) || '[]');
    const updated = records.map(r => r.id === id ? { ...r, ...updates } : r);
    localStorage.setItem(localKey, JSON.stringify(updated));
    
    // Broadcast change for UI
    window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entityKey } }));
  },

  /**
   * Map local record to Cloud schema
   */
  mapLocalToCloud(record, entityKey) {
    if (entityKey === 'fillups') {
      const now = new Date().toISOString();
      return {
        // Identity
        stable_key: record.stableKey,
        user_id: null, // Caller must set this
        // Ownership
        vehicle_id: record.vehicleId,
        // Data fields — snake_case only, no camelCase, no 'timestamp'
        date: record.date || null,
        created_at: record.createdAt || now,
        odometer: record.odometer,
        liters: record.liters,
        price_per_liter: record.pricePerLiter,
        total_cost: record.totalCost,
        station: record.station || null,
        full_tank: record.fullTank !== undefined ? record.fullTank : true,
        notes: record.notes || null,
        // Sync metadata
        updated_at: record.updatedAt || now,
        deleted_at: record.deletedAt || null
      };
    }
    return record;
  },

  /**
   * Queue a background sync for later processing
   * This is called when offline or when sync fails
   * @returns {void}
   */
  queueBackgroundSync() {
    console.log('[Sync][background] Queuing background sync');
    localStorage.setItem(BACKGROUND_SYNC_LOCK_KEY, Date.now().toString());
  },

  /**
   * Compute diff between local and cloud data for any entity
   * @param {Array} localRecords - Local records
   * @param {Array} cloudRecords - Cloud records
   * @param {string} type - Entity type ('vehicle', 'fillup', 'maintenance', 'trip')
   * @returns {Object} Diff classification
   */
  /**
   * Normalize legacy records - ensures all records have stableKey and updatedAt
   */
  normalizeLegacyRecords(records) {
    let changed = false;
    const normalized = records.map(r => {
      let recordChanged = false;
      const updates = {};
      
      if (!r.stableKey) {
        updates.stableKey = isValidUuid(r.id) ? r.id : uuidv4();
        recordChanged = true;
      }
      
      if (!r.updatedAt) {
        updates.updatedAt = r.timestamp || r.createdAt || new Date().toISOString();
        recordChanged = true;
      }

      if (recordChanged) {
        changed = true;
        return { ...r, ...updates };
      }
      return r;
    });
    
    return { normalized, changed };
  },

  computeDiff(localRecords, cloudRecords, type) {
    const diff = {
      localOnly: [],
      cloudOnly: [],
      bothChanged: [],
      localDeleted: [],
      cloudDeleted: [],
      identical: []
    };

    const localMap = new Map();
    const cloudMap = new Map();

    localRecords.forEach(r => {
      // Use stableKey as primary identity, fallback to UUID-like id
      const key = r.stableKey || r.id;
      localMap.set(key, r);
    });

    cloudRecords.forEach(r => {
      const key = r.stable_key || r.id;
      cloudMap.set(key, r);
    });

    // Content comparison fields per type
    const fieldMap = {
      vehicle: {
        name: 'name', tank_capacity: 'tankCapacity', make: 'make', 
        model: 'model', year: 'year', fuel_type: 'fuelType', license_plate: 'licensePlate'
      },
      fillup: {
        odometer: 'odometer', liters: 'liters', pricePerLiter: 'price_per_liter',
        totalCost: 'total_cost', station: 'station', notes: 'notes', fullTank: 'full_tank'
      }
      // Add other entities as needed
    };

    const fields = fieldMap[type] || {};

    localMap.forEach((local, key) => {
      const cloud = cloudMap.get(key);
      
      if (!cloud) {
        if (local.deletedAt || local.lastAction === 'DELETE') {
          diff.localDeleted.push(local);
        } else {
          diff.localOnly.push(local);
        }
      } else {
        // Strict Tombstone & Delete-Wins Logic
        const isLocalDeleted = !!(local.deletedAt || local.lastAction === 'DELETE');
        const isCloudDeleted = !!cloud.deleted_at;

        if (isLocalDeleted && !isCloudDeleted) {
          diff.localDeleted.push(local);
        } else if (!isLocalDeleted && isCloudDeleted) {
          diff.cloudDeleted.push(local);
        } else if (isLocalDeleted && isCloudDeleted) {
          diff.identical.push({ local, cloud });
        } else {
          const localUpdated = local.updatedAt || local.timestamp;
          const cloudUpdated = cloud.updated_at || cloud.created_at;
          
          let contentChanged = false;
          // Check fields for content change
          for (const [cloudField, localField] of Object.entries(fields)) {
            if (String(local[localField]) !== String(cloud[cloudField])) {
              contentChanged = true;
              break;
            }
          }

          if (contentChanged) {
            const localTime = new Date(localUpdated).getTime();
            const cloudTime = new Date(cloudUpdated).getTime();
            
            // Replay-safe reconciliation: latest updated wins
            // but delete-wins is handled above by strict tombstone logic
            const winner = localTime > cloudTime ? 'local' : 'cloud';
            
            diff.bothChanged.push({
              local, cloud, winner,
              localUpdated, cloudUpdated, type
            });
          } else {
            diff.identical.push({ local, cloud });
          }
        }
      }
    });

    cloudMap.forEach((cloud, key) => {
      if (!localMap.has(key)) {
        if (cloud.deleted_at) {
          diff.cloudDeleted.push(cloud);
        } else {
          diff.cloudOnly.push(cloud);
        }
      }
    });

    return diff;
  },

  /**
   * Get detailed sync diff for all entities
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Aggregated diff
   */
  async getDetailedSyncDiff(userId) {
    const categories = [
      { key: 'vehicles', table: 'vehicles', type: 'vehicle', localKey: 'fueltracker-vehicles-v2' },
      { key: 'fillups', table: 'fillups', type: 'fillup', localKey: 'fueltracker-fillups-v2' },
      { key: 'maintenance', table: 'maintenance', type: 'maintenance', localKey: 'fueltracker-maintenance-entries-v3' },
      { key: 'tripEstimates', table: 'trip_estimates', type: 'trip', localKey: 'fueltracker-trip-estimates-v2' }
    ];

    const detailedDiff = {
      summary: {
        localOnly: 0,
        cloudOnly: 0,
        bothChanged: 0,
        localDeleted: 0,
        cloudDeleted: 0
      },
      entities: {},
      conflicts: [],
      nonConflicts: {
        localOnly: [],
        cloudOnly: [],
        localDeleted: [],
        cloudDeleted: []
      }
    };

    for (const cat of categories) {
      const localRecords = JSON.parse(localStorage.getItem(cat.localKey) || '[]');
      const { data: cloudRecords } = await supabase.from(cat.table).select('*').eq('user_id', userId);
      
      const diff = this.computeDiff(localRecords, cloudRecords || [], cat.type);
      detailedDiff.entities[cat.key] = diff;
      
      detailedDiff.summary.localOnly += diff.localOnly.length;
      detailedDiff.summary.cloudOnly += diff.cloudOnly.length;
      detailedDiff.summary.bothChanged += diff.bothChanged.length;
      detailedDiff.summary.localDeleted += diff.localDeleted.length;
      detailedDiff.summary.cloudDeleted += diff.cloudDeleted.length;

      detailedDiff.conflicts.push(...diff.bothChanged);
      
      detailedDiff.nonConflicts.localOnly.push(...diff.localOnly.map(r => ({ ...r, entityType: cat.key })));
      detailedDiff.nonConflicts.cloudOnly.push(...diff.cloudOnly.map(r => ({ ...r, entityType: cat.key })));
      detailedDiff.nonConflicts.localDeleted.push(...diff.localDeleted.map(r => ({ ...r, entityType: cat.key })));
      detailedDiff.nonConflicts.cloudDeleted.push(...diff.cloudDeleted.map(r => ({ ...r, entityType: cat.key })));
    }

    return detailedDiff;
  },

  /**
   * Compute diff between local and cloud data for fill-ups
   * @param {Array} localFillups - Local fill-up records
   * @param {Array} cloudFillups - Cloud fill-up records
   * @returns {Object} Diff classification
   */
  computeFillupDiff(localFillups, cloudFillups) {
    const diff = {
      localOnly: [],
      cloudOnly: [],
      bothChanged: [],
      localDeleted: [],
      cloudDeleted: [],
      identical: []
    };

    // Create maps for efficient lookup
    const localMap = new Map();
    const cloudMap = new Map();

    // Index local records by stable_key (or id as fallback)
    localFillups.forEach(f => {
      const key = f.stableKey || f.id;
      localMap.set(key, f);
    });

    // Index cloud records by stable_key (or id as fallback)
    cloudFillups.forEach(f => {
      const key = f.stable_key || f.id;
      cloudMap.set(key, f);
    });

    // Find local-only and both-changed records
    localMap.forEach((local, key) => {
      const cloud = cloudMap.get(key);
      if (!cloud) {
        // Record exists locally but not in cloud
        if (local.deletedAt) {
          diff.localDeleted.push(local);
        } else {
          diff.localOnly.push(local);
        }
      } else {
        // Record exists in both
        if (local.deletedAt && !cloud.deleted_at) {
          diff.localDeleted.push(local);
        } else if (!local.deletedAt && cloud.deleted_at) {
          diff.cloudDeleted.push(local);
        } else if (local.deletedAt && cloud.deleted_at) {
          // Both deleted - identical
          diff.identical.push({ local, cloud });
        } else {
          // Both active - check if changed
          const localUpdated = local.updatedAt || local.timestamp;
          const cloudUpdated = cloud.updated_at || cloud.created_at;
          
          // Compare key fields for content changes
          const contentChanged = 
            local.odometer !== cloud.odometer ||
            local.liters !== cloud.liters ||
            local.pricePerLiter !== cloud.price_per_liter ||
            local.totalCost !== cloud.total_cost ||
            local.station !== cloud.station ||
            local.notes !== cloud.notes ||
            local.fullTank !== cloud.full_tank;

          if (contentChanged) {
            // Determine winner based on updated_at
            const localTime = new Date(localUpdated).getTime();
            const cloudTime = new Date(cloudUpdated).getTime();
            const winner = localTime > cloudTime ? 'local' : 'cloud';
            
            diff.bothChanged.push({
              local,
              cloud,
              winner,
              localUpdated: localUpdated,
              cloudUpdated: cloudUpdated
            });
          } else {
            diff.identical.push({ local, cloud });
          }
        }
      }
    });

    // Find cloud-only records
    cloudMap.forEach((cloud, key) => {
      if (!localMap.has(key)) {
        // Record exists in cloud but not locally
        if (cloud.deleted_at) {
          diff.cloudDeleted.push(cloud);
        } else {
          diff.cloudOnly.push(cloud);
        }
      }
    });

    return diff;
  },

  /**
   * Apply diff to local and cloud based on sync action
   * @param {Object} diff - Diff classification from computeFillupDiff
   * @param {string} action - Sync action: 'sync-both', 'upload-local', 'replace-local'
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result summary
   */
  /**
   * Apply diff to local and cloud based on sync action
   * @param {Object} diff - Diff classification
   * @param {string} action - Sync action
   * @param {string} type - Entity type
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result summary
   */
  async applyDiff(diff, action, type, userId) {
    const result = {
      uploaded: 0,
      downloaded: 0,
      deletedFromCloud: 0,
      deletedFromLocal: 0,
      conflictsResolved: 0,
      errors: []
    };

    try {
      switch (action) {
        case 'sync-both':
          result.uploaded += diff.localOnly.length;
          result.downloaded += diff.cloudOnly.length;
          result.deletedFromCloud += diff.localDeleted.length;
          result.deletedFromLocal += diff.cloudDeleted.length;
          
          for (const record of diff.localOnly) await this.uploadSingle(record, type, userId);
          for (const record of diff.cloudOnly) this.downloadSingle(record, type);
          for (const record of diff.localDeleted) {
            if (isValidUuid(record.stableKey || record.id)) await this.deleteFromCloud(record, type, userId);
          }
          for (const record of diff.cloudDeleted) this.deleteFromLocal(record, type);
          
          for (const conflict of diff.bothChanged) {
            if (conflict.winner === 'local') {
              await this.uploadSingle(conflict.local, type, userId);
            } else {
              this.downloadSingle(conflict.cloud, type);
            }
            result.conflictsResolved++;
          }
          break;

        case 'upload-local':
          result.uploaded += diff.localOnly.length + diff.bothChanged.length;
          result.deletedFromCloud += diff.localDeleted.length;
          
          for (const record of diff.localOnly) await this.uploadSingle(record, type, userId);
          for (const record of diff.localDeleted) {
            if (isValidUuid(record.stableKey || record.id)) await this.deleteFromCloud(record, type, userId);
          }
          for (const conflict of diff.bothChanged) {
            await this.uploadSingle(conflict.local, type, userId);
            result.conflictsResolved++;
          }
          break;

        case 'replace-local':
          result.downloaded += diff.cloudOnly.length + diff.bothChanged.length;
          result.deletedFromLocal += diff.cloudDeleted.length + diff.localOnly.length;
          
          for (const record of diff.cloudOnly) this.downloadSingle(record, type);
          for (const record of diff.localOnly) this.deleteFromLocal(record, type);
          for (const record of diff.cloudDeleted) this.deleteFromLocal(record, type);
          for (const conflict of diff.bothChanged) {
            this.downloadSingle(conflict.cloud, type);
            result.conflictsResolved++;
          }
          break;
      }
    } catch (error) {
      console.error(`[Sync][applyDiff] Error applying diff for ${type}:`, error);
      result.errors.push(error.message);
    }

    return result;
  },

  /**
   * Upload a single record of any type
   */
  async uploadSingle(record, type, userId) {
    console.log(`[Sync][uploadSingle] Type: ${type}, Record ID: ${record.id}, stableKey: ${record.stableKey}`);
    
    // Guardrail: Check if handler exists before calling
    switch (type) {
      case 'vehicle':
        if (typeof this.uploadSingleVehicle !== 'function') {
          const error = `uploadSingleVehicle handler does not exist for entity type: ${type}`;
          console.error(`[Sync][uploadSingle] ${error}`);
          throw new Error(error);
        }
        return this.uploadSingleVehicle(record, userId);
      case 'fillup':
        if (typeof this.uploadSingleFillup !== 'function') {
          const error = `uploadSingleFillup handler does not exist for entity type: ${type}`;
          console.error(`[Sync][uploadSingle] ${error}`);
          throw new Error(error);
        }
        return this.uploadSingleFillup(record, userId);
      case 'maintenance':
        if (typeof this.uploadSingleMaintenance !== 'function') {
          const error = `uploadSingleMaintenance handler does not exist for entity type: ${type}`;
          console.error(`[Sync][uploadSingle] ${error}`);
          throw new Error(error);
        }
        return this.uploadSingleMaintenance(record, userId);
      case 'trip':
        if (typeof this.uploadSingleTripEstimate !== 'function') {
          const error = `uploadSingleTripEstimate handler does not exist for entity type: ${type}`;
          console.error(`[Sync][uploadSingle] ${error}`);
          throw new Error(error);
        }
        return this.uploadSingleTripEstimate(record, userId);
      default:
        const error = `Unknown entity type: ${type}`;
        console.error(`[Sync][uploadSingle] ${error}`);
        throw new Error(error);
    }
  },

  /**
   * Download a single record of any type
   */
  downloadSingle(record, type) {
    switch (type) {
      case 'vehicle': return this.downloadSingleVehicle(record);
      case 'fillup': return this.downloadSingleFillup(record);
      case 'maintenance': return this.downloadSingleMaintenance(record);
      case 'trip': return this.downloadSingleTripEstimate(record);
    }
  },

  /**
   * Delete a single record from cloud
   */
  async deleteFromCloud(record, type, userId) {
    switch (type) {
      case 'vehicle': return this.deleteVehicleFromCloud(record, userId);
      case 'fillup': return this.deleteFillupFromCloud(record, userId);
      case 'maintenance': return this.deleteMaintenanceFromCloud(record, userId);
      case 'trip': return this.deleteTripFromCloud(record, userId);
    }
  },

  /**
   * Delete a single record from local
   */
  deleteFromLocal(record, type) {
    switch (type) {
      case 'vehicle': return this.deleteVehicleFromLocal(record);
      case 'fillup': return this.deleteFillupFromLocal(record);
      case 'maintenance': return this.deleteMaintenanceFromLocal(record);
      case 'trip': return this.deleteTripFromLocal(record);
    }
  },

  /**
   * Apply diff to local and cloud based on sync action (legacy wrapper)
   */
  async applyFillupDiff(diff, action, userId) {
    return this.applyDiff(diff, action, 'fillup', userId);
  },

  /**
   * Upload a single vehicle to cloud
   * @param {Object} vehicle - Local vehicle record
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async uploadSingleVehicle(vehicle, userId) {
    // Validate inputs before making request
    if (!userId) {
      const error = 'userId is required but was undefined';
      console.error(`[Sync][uploadSingleVehicle] Validation failed: ${error}`);
      console.error(`[Sync][uploadSingleVehicle] Caller: ${new Error().stack}`);
      throw new Error(error);
    }
    if (!this.isValidUuid(userId)) {
      const error = `userId is not a valid UUID: ${userId}`;
      console.error(`[Sync][uploadSingleVehicle] Validation failed: ${error}`);
      throw new Error(error);
    }
    if (!vehicle.stableKey) {
      const error = 'stableKey is required but was undefined';
      console.error(`[Sync][uploadSingleVehicle] Validation failed: ${error}`);
      throw new Error(error);
    }

    console.log(`[Sync][uploadSingleVehicle] Starting upload for stable_key: ${vehicle.stableKey}, userId: ${userId}`);

    const now = new Date().toISOString();
    
    // First, check if a row exists with this stable_key and user_id
    const { data: existingRow, error: fetchErr } = await supabase
      .from('vehicles')
      .select('id')
      .eq('stable_key', vehicle.stableKey)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[Sync][uploadSingleVehicle] Fetch existing row failed for ${vehicle.stableKey} (code: ${fetchErr.code}):`, fetchErr.message);
      throw new Error(`Failed to check existing vehicle ${vehicle.id}: ${fetchErr.message}`);
    }

    const normalized = {
      user_id: userId,
      name: vehicle.name,
      make: vehicle.make || null,
      model: vehicle.model || null,
      year: vehicle.year || null,
      fuel_type: vehicle.fuelType || null,
      tank_capacity: vehicle.tankCapacity || null,
      license_plate: vehicle.licensePlate || null,
      stable_key: vehicle.stableKey,
      created_at: vehicle.createdAt || now,
      updated_at: vehicle.updatedAt || now,
      deleted_at: vehicle.deletedAt || null
    };

    console.log(`[Sync][uploadSingleVehicle] Payload keys:`, Object.keys(normalized));
    console.log(`[Sync][uploadSingleVehicle] Payload for vehicle ${vehicle.stableKey}:`, JSON.stringify(normalized, null, 2));

    if (existingRow) {
      // Row exists - UPDATE by id (the primary key)
      console.log(`[Sync][uploadSingleVehicle] Existing row found with id: ${existingRow.id}, updating by id`);
      const { error: updateErr } = await supabase
        .from('vehicles')
        .update(normalized)
        .eq('id', existingRow.id);

      if (updateErr) {
        console.error(`[Sync][uploadSingleVehicle] UPDATE failed for ${vehicle.stableKey} (code: ${updateErr.code}):`, updateErr.message);
        throw new Error(`Failed to update vehicle ${vehicle.id}: ${updateErr.message}`);
      }
      console.log(`[Sync][uploadSingleVehicle] UPDATE succeeded for ${vehicle.stableKey}`);
    } else {
      // Row doesn't exist - INSERT without id (let database generate it)
      console.log(`[Sync][uploadSingleVehicle] No existing row for ${vehicle.stableKey}, inserting`);
      const { error: insertErr } = await supabase.from('vehicles').insert(normalized);
      if (insertErr) {
        console.error(`[Sync][uploadSingleVehicle] INSERT failed for ${vehicle.stableKey} (code: ${insertErr.code}):`, insertErr.message);
        throw new Error(`Failed to insert vehicle ${vehicle.id}: ${insertErr.message}`);
      }
      console.log(`[Sync][uploadSingleVehicle] INSERT succeeded for ${vehicle.stableKey}`);
    }
  },

  /**
   * Build a mapping from local vehicle IDs to cloud vehicle UUIDs
   * @param {string} userId - User ID
   * @returns {Promise<Map>} Map of local vehicle ID -> cloud vehicle UUID
   */
  async buildVehicleIdMap(userId) {
    console.log('[Sync][buildVehicleIdMap] Building local->cloud vehicle ID map');
    
    const localVehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
    const { data: cloudVehicles, error: cloudError } = await supabase
      .from('vehicles')
      .select('id, stable_key')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (cloudError) {
      console.error('[Sync][buildVehicleIdMap] Failed to fetch cloud vehicles:', cloudError.message);
      throw new Error(`Failed to fetch cloud vehicles: ${cloudError.message}`);
    }

    const vehicleIdMap = new Map();
    
    // Map by stable_key (preferred)
    const cloudVehicleByStableKey = new Map();
    (cloudVehicles || []).forEach(cv => {
      if (cv.stable_key) {
        cloudVehicleByStableKey.set(cv.stable_key, cv.id);
      }
    });

    localVehicles.forEach(lv => {
      if (lv.stableKey && cloudVehicleByStableKey.has(lv.stableKey)) {
        // Map by stable_key match
        vehicleIdMap.set(lv.id, cloudVehicleByStableKey.get(lv.stableKey));
        console.log(`[Sync][buildVehicleIdMap] Mapped local vehicle ${lv.id} -> cloud ${cloudVehicleByStableKey.get(lv.stableKey)} by stable_key`);
      } else if (this.isValidUuid(lv.id)) {
        // Direct UUID match (if local ID is already a UUID and exists in cloud)
        const cloudMatch = (cloudVehicles || []).find(cv => cv.id === lv.id);
        if (cloudMatch) {
          vehicleIdMap.set(lv.id, cloudMatch.id);
          console.log(`[Sync][buildVehicleIdMap] Mapped local vehicle ${lv.id} -> cloud ${cloudMatch.id} by direct UUID match`);
        }
      }
    });

    console.log(`[Sync][buildVehicleIdMap] Built map with ${vehicleIdMap.size} mappings`);
    return vehicleIdMap;
  },

  /**
   * Upload a single fill-up to cloud
   * @param {Object} fillup - Local fill-up record
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async uploadSingleFillup(fillup, userId) {
    // Validate inputs before making request
    if (!userId) {
      const error = 'userId is required but was undefined';
      console.error(`[Sync][uploadSingleFillup] Validation failed: ${error}`);
      console.error(`[Sync][uploadSingleFillup] Caller: ${new Error().stack}`);
      throw new Error(error);
    }
    if (!this.isValidUuid(userId)) {
      const error = `userId is not a valid UUID: ${userId}`;
      console.error(`[Sync][uploadSingleFillup] Validation failed: ${error}`);
      throw new Error(error);
    }
    if (!fillup.stableKey) {
      const error = 'stableKey is required but was undefined';
      console.error(`[Sync][uploadSingleFillup] Validation failed: ${error}`);
      throw new Error(error);
    }

    // Preflight validation: vehicle_id must be a valid UUID or mappable
    if (!fillup.vehicleId) {
      const error = 'vehicleId is required but was undefined';
      console.error(`[Sync][uploadSingleFillup] Validation failed: ${error}`);
      throw new Error(error);
    }
    
    // Check if vehicleId is a placeholder like "default"
    if (fillup.vehicleId === 'default' || fillup.vehicleId === '' || !this.isValidUuid(fillup.vehicleId)) {
      // Try to map local vehicle ID to cloud vehicle UUID
      console.log(`[Sync][uploadSingleFillup] vehicleId "${fillup.vehicleId}" is not a valid UUID, attempting to map`);
      const vehicleIdMap = await this.buildVehicleIdMap(userId);
      const cloudVehicleId = vehicleIdMap.get(fillup.vehicleId);
      
      if (!cloudVehicleId) {
        const error = `Cannot map vehicleId "${fillup.vehicleId}" to a valid cloud vehicle UUID. Vehicle must be synced first.`;
        console.error(`[Sync][uploadSingleFillup] Validation failed: ${error}`);
        throw new Error(error);
      }
      
      fillup.vehicleId = cloudVehicleId;
      console.log(`[Sync][uploadSingleFillup] Mapped vehicleId to cloud UUID: ${cloudVehicleId}`);
    }

    console.log(`[Sync][uploadSingleFillup] Starting upload for stable_key: ${fillup.stableKey}, userId: ${userId}, vehicleId: ${fillup.vehicleId}`);

    const now = new Date().toISOString();
    
    // First, check if a row exists with this stable_key and user_id
    const { data: existingRow, error: fetchErr } = await supabase
      .from('fillups')
      .select('id')
      .eq('stable_key', fillup.stableKey)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[Sync][uploadSingleFillup] Fetch existing row failed for ${fillup.stableKey} (code: ${fetchErr.code}):`, fetchErr.message);
      throw new Error(`Failed to check existing fillup ${fillup.id}: ${fetchErr.message}`);
    }

    const normalized = {
      user_id: userId,
      vehicle_id: fillup.vehicleId,
      date: fillup.date,
      odometer: fillup.odometer,
      liters: fillup.liters,
      price_per_liter: fillup.pricePerLiter,
      total_cost: fillup.totalCost,
      station: fillup.station || null,
      notes: fillup.notes || null,
      full_tank: fillup.fullTank !== undefined ? fillup.fullTank : true,
      stable_key: fillup.stableKey,
      created_at: fillup.createdAt || now,
      updated_at: fillup.updatedAt || now,
      deleted_at: fillup.deletedAt || null
    };

    console.log(`[Sync][uploadSingleFillup] Payload keys:`, Object.keys(normalized));
    console.log(`[Sync][uploadSingleFillup] Payload for fillup ${fillup.stableKey}:`, JSON.stringify(normalized, null, 2));

    if (existingRow) {
      // Row exists - UPDATE by id (the primary key)
      console.log(`[Sync][uploadSingleFillup] Existing row found with id: ${existingRow.id}, updating by id`);
      const { error: updateErr } = await supabase
        .from('fillups')
        .update(normalized)
        .eq('id', existingRow.id);

      if (updateErr) {
        console.error(`[Sync][uploadSingleFillup] UPDATE failed for ${fillup.stableKey} (code: ${updateErr.code}):`, updateErr.message);
        throw new Error(`Failed to update fillup ${fillup.id}: ${updateErr.message}`);
      }
      console.log(`[Sync][uploadSingleFillup] UPDATE succeeded for ${fillup.stableKey}`);
    } else {
      // Row doesn't exist - INSERT without id (let database generate it)
      console.log(`[Sync][uploadSingleFillup] No existing row for ${fillup.stableKey}, inserting`);
      const { error: insertErr } = await supabase.from('fillups').insert(normalized);
      if (insertErr) {
        console.error(`[Sync][uploadSingleFillup] INSERT failed for ${fillup.stableKey} (code: ${insertErr.code}):`, insertErr.message);
        throw new Error(`Failed to insert fillup ${fillup.id}: ${insertErr.message}`);
      }
      console.log(`[Sync][uploadSingleFillup] INSERT succeeded for ${fillup.stableKey}`);
    }
  },

  /**
   * Upload a single maintenance entry to cloud
   * @param {Object} maintenance - Local maintenance record
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async uploadSingleMaintenance(maintenance, userId) {
    // Validate inputs before making request
    if (!userId) {
      const error = 'userId is required but was undefined';
      console.error(`[Sync][uploadSingleMaintenance] Validation failed: ${error}`);
      throw new Error(error);
    }
    if (!this.isValidUuid(userId)) {
      const error = `userId is not a valid UUID: ${userId}`;
      console.error(`[Sync][uploadSingleMaintenance] Validation failed: ${error}`);
      throw new Error(error);
    }
    if (!maintenance.id) {
      const error = 'id is required but was undefined';
      console.error(`[Sync][uploadSingleMaintenance] Validation failed: ${error}`);
      throw new Error(error);
    }

    // Preflight validation: vehicle_id must be a valid UUID or mappable
    if (maintenance.vehicleId) {
      if (maintenance.vehicleId === 'default' || maintenance.vehicleId === '' || !this.isValidUuid(maintenance.vehicleId)) {
        // Try to map local vehicle ID to cloud vehicle UUID
        console.log(`[Sync][uploadSingleMaintenance] vehicleId "${maintenance.vehicleId}" is not a valid UUID, attempting to map`);
        const vehicleIdMap = await this.buildVehicleIdMap(userId);
        const cloudVehicleId = vehicleIdMap.get(maintenance.vehicleId);
        
        if (!cloudVehicleId) {
          const error = `Cannot map vehicleId "${maintenance.vehicleId}" to a valid cloud vehicle UUID. Vehicle must be synced first.`;
          console.error(`[Sync][uploadSingleMaintenance] Validation failed: ${error}`);
          throw new Error(error);
        }
        
        maintenance.vehicleId = cloudVehicleId;
        console.log(`[Sync][uploadSingleMaintenance] Mapped vehicleId to cloud UUID: ${cloudVehicleId}`);
      }
    }

    console.log(`[Sync][uploadSingleMaintenance] Starting upload for id: ${maintenance.id}, userId: ${userId}`);

    const now = new Date().toISOString();
    
    // First, check if a row exists with this id and user_id
    const { data: existingRow, error: fetchErr } = await supabase
      .from('maintenance')
      .select('id')
      .eq('id', maintenance.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[Sync][uploadSingleMaintenance] Fetch existing row failed for ${maintenance.id} (code: ${fetchErr.code}):`, fetchErr.message);
      throw new Error(`Failed to check existing maintenance ${maintenance.id}: ${fetchErr.message}`);
    }

    const normalized = {
      user_id: userId,
      vehicle_id: maintenance.vehicleId,
      date: maintenance.date,
      type: maintenance.type || null,
      description: maintenance.description || null,
      cost: maintenance.cost || null,
      odometer: maintenance.odometer || null,
      next_due_date: maintenance.nextDueDate || null,
      next_due_odometer: maintenance.nextDueOdometer || null,
      created_at: maintenance.createdAt || now,
      updated_at: maintenance.updatedAt || now,
      deleted_at: maintenance.deletedAt || null
    };

    console.log(`[Sync][uploadSingleMaintenance] Payload keys:`, Object.keys(normalized));

    if (existingRow) {
      // Row exists - UPDATE by id (the primary key)
      console.log(`[Sync][uploadSingleMaintenance] Existing row found with id: ${existingRow.id}, updating by id`);
      const { error: updateErr } = await supabase
        .from('maintenance')
        .update(normalized)
        .eq('id', existingRow.id);

      if (updateErr) {
        console.error(`[Sync][uploadSingleMaintenance] UPDATE failed for ${maintenance.id} (code: ${updateErr.code}):`, updateErr.message);
        throw new Error(`Failed to update maintenance ${maintenance.id}: ${updateErr.message}`);
      }
      console.log(`[Sync][uploadSingleMaintenance] UPDATE succeeded for ${maintenance.id}`);
    } else {
      // Row doesn't exist - INSERT without id (let database generate it)
      console.log(`[Sync][uploadSingleMaintenance] No existing row for ${maintenance.id}, inserting`);
      const { error: insertErr } = await supabase.from('maintenance').insert(normalized);
      if (insertErr) {
        console.error(`[Sync][uploadSingleMaintenance] INSERT failed for ${maintenance.id} (code: ${insertErr.code}):`, insertErr.message);
        throw new Error(`Failed to insert maintenance ${maintenance.id}: ${insertErr.message}`);
      }
      console.log(`[Sync][uploadSingleMaintenance] INSERT succeeded for ${maintenance.id}`);
    }
  },

  /**
   * Upload a single trip estimate to cloud
   * @param {Object} trip - Local trip estimate record
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async uploadSingleTripEstimate(trip, userId) {
    // Validate inputs before making request
    if (!userId) {
      const error = 'userId is required but was undefined';
      console.error(`[Sync][uploadSingleTripEstimate] Validation failed: ${error}`);
      throw new Error(error);
    }
    if (!this.isValidUuid(userId)) {
      const error = `userId is not a valid UUID: ${userId}`;
      console.error(`[Sync][uploadSingleTripEstimate] Validation failed: ${error}`);
      throw new Error(error);
    }
    if (!trip.id) {
      const error = 'id is required but was undefined';
      console.error(`[Sync][uploadSingleTripEstimate] Validation failed: ${error}`);
      throw new Error(error);
    }

    // Preflight validation: vehicle_id must be a valid UUID or mappable
    if (trip.vehicleId) {
      if (trip.vehicleId === 'default' || trip.vehicleId === '' || !this.isValidUuid(trip.vehicleId)) {
        // Try to map local vehicle ID to cloud vehicle UUID
        console.log(`[Sync][uploadSingleTripEstimate] vehicleId "${trip.vehicleId}" is not a valid UUID, attempting to map`);
        const vehicleIdMap = await this.buildVehicleIdMap(userId);
        const cloudVehicleId = vehicleIdMap.get(trip.vehicleId);
        
        if (!cloudVehicleId) {
          const error = `Cannot map vehicleId "${trip.vehicleId}" to a valid cloud vehicle UUID. Vehicle must be synced first.`;
          console.error(`[Sync][uploadSingleTripEstimate] Validation failed: ${error}`);
          throw new Error(error);
        }
        
        trip.vehicleId = cloudVehicleId;
        console.log(`[Sync][uploadSingleTripEstimate] Mapped vehicleId to cloud UUID: ${cloudVehicleId}`);
      }
    }

    console.log(`[Sync][uploadSingleTripEstimate] Starting upload for id: ${trip.id}, userId: ${userId}`);

    const now = new Date().toISOString();
    
    // First, check if a row exists with this id and user_id
    const { data: existingRow, error: fetchErr } = await supabase
      .from('trip_estimates')
      .select('id')
      .eq('id', trip.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[Sync][uploadSingleTripEstimate] Fetch existing row failed for ${trip.id} (code: ${fetchErr.code}):`, fetchErr.message);
      throw new Error(`Failed to check existing trip estimate ${trip.id}: ${fetchErr.message}`);
    }

    const normalized = {
      user_id: userId,
      vehicle_id: trip.vehicleId,
      name: trip.name || null,
      distance: trip.distance || null,
      notes: trip.notes || null,
      created_at: trip.createdAt || now,
      updated_at: trip.updatedAt || now,
      deleted_at: trip.deletedAt || null
    };

    console.log(`[Sync][uploadSingleTripEstimate] Payload keys:`, Object.keys(normalized));

    if (existingRow) {
      // Row exists - UPDATE by id (the primary key)
      console.log(`[Sync][uploadSingleTripEstimate] Existing row found with id: ${existingRow.id}, updating by id`);
      const { error: updateErr } = await supabase
        .from('trip_estimates')
        .update(normalized)
        .eq('id', existingRow.id);

      if (updateErr) {
        console.error(`[Sync][uploadSingleTripEstimate] UPDATE failed for ${trip.id} (code: ${updateErr.code}):`, updateErr.message);
        throw new Error(`Failed to update trip estimate ${trip.id}: ${updateErr.message}`);
      }
      console.log(`[Sync][uploadSingleTripEstimate] UPDATE succeeded for ${trip.id}`);
    } else {
      // Row doesn't exist - INSERT without id (let database generate it)
      console.log(`[Sync][uploadSingleTripEstimate] No existing row for ${trip.id}, inserting`);
      const { error: insertErr } = await supabase.from('trip_estimates').insert(normalized);
      if (insertErr) {
        console.error(`[Sync][uploadSingleTripEstimate] INSERT failed for ${trip.id} (code: ${insertErr.code}):`, insertErr.message);
        throw new Error(`Failed to insert trip estimate ${trip.id}: ${insertErr.message}`);
      }
      console.log(`[Sync][uploadSingleTripEstimate] INSERT succeeded for ${trip.id}`);
    }
  },

  /**
   * Download a single fill-up from cloud to local
   * @param {Object} fillup - Cloud fill-up record
   * @returns {void}
   */
  downloadSingleFillup(fillup) {
    const mapped = {
      id: fillup.id,
      vehicleId: fillup.vehicle_id,
      date: fillup.date,
      odometer: fillup.odometer,
      liters: fillup.liters,
      pricePerLiter: fillup.price_per_liter,
      totalCost: fillup.total_cost,
      station: fillup.station,
      notes: fillup.notes,
      fullTank: fillup.full_tank,
      timestamp: fillup.created_at,
      updatedAt: fillup.updated_at,
      stableKey: fillup.stable_key,
      deletedAt: fillup.deleted_at
    };

    const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
    const existingIndex = fillups.findIndex(f => f.id === fillup.id);
    
    if (existingIndex >= 0) {
      fillups[existingIndex] = mapped;
    } else {
      fillups.push(mapped);
    }
    
    localStorage.setItem('fueltracker-fillups-v2', JSON.stringify(fillups));
  },

  /**
   * Delete a fill-up from cloud (tombstone)
   * @param {Object} fillup - Local fill-up record
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deleteFillupFromCloud(fillup, userId) {
    const { error } = await supabase
      .from('fillups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fillup.id)
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Failed to delete fillup ${fillup.id} from cloud: ${error.message}`);
    }
  },

  /**
   * Delete a fill-up from local storage
   * @param {Object} fillup - Fill-up record to delete
   * @returns {void}
   */
  deleteFillupFromLocal(fillup) {
    const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
    const filtered = fillups.filter(f => f.id !== fillup.id);
    localStorage.setItem('fueltracker-fillups-v2', JSON.stringify(filtered));
  },

  /**
   * Sync both sides - bidirectional merge
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Sync result
   */
  async syncBothSides(userId) {
    console.log('[Sync][syncBothSides] Starting bidirectional sync');
    const result = {
      success: false,
      action: 'sync-both',
      message: '',
      details: [],
      counts: { vehicles: 0, fillups: 0, maintenance: 0, tripEstimates: 0 },
      summary: { uploaded: 0, downloaded: 0, deletedFromCloud: 0, deletedFromLocal: 0, conflictsResolved: 0 }
    };

    try {
      const detailedDiff = await this.getDetailedSyncDiff(userId);

      // Check for conflicts first
      if (detailedDiff.conflicts.length > 0) {
        console.log('[Sync][syncBothSides] Conflicts detected, returning for user resolution');
        result.needsResolution = true;
        result.conflicts = detailedDiff.conflicts;
        result.nonConflicts = detailedDiff.nonConflicts;
        result.summary.unchanged = detailedDiff.summary.identical;
        result.message = `${detailedDiff.conflicts.length} conflict${detailedDiff.conflicts.length !== 1 ? 's' : ''} detected that require review.`;
        return result;
      }

      const entities = [
        { key: 'vehicles', type: 'vehicle' },
        { key: 'fillups', type: 'fillup' },
        { key: 'maintenance', type: 'maintenance' },
        { key: 'tripEstimates', type: 'trip' }
      ];

      for (const ent of entities) {
        const diff = detailedDiff.entities[ent.key];
        const applyResult = await this.applyDiff(diff, 'sync-both', ent.type, userId);
        
        result.summary.uploaded += applyResult.uploaded;
        result.summary.downloaded += applyResult.downloaded;
        result.summary.deletedFromCloud += applyResult.deletedFromCloud;
        result.summary.deletedFromLocal += applyResult.deletedFromLocal;
        result.summary.conflictsResolved += applyResult.conflictsResolved;
        result.counts[ent.key] = applyResult.uploaded + applyResult.downloaded;
        result.details.push(...applyResult.errors);
      }

      result.success = result.details.length === 0;
      result.message = result.success 
        ? `Sync complete: ${result.summary.uploaded} uploaded, ${result.summary.downloaded} downloaded.`
        : 'Sync completed with errors';
    } catch (error) {
      console.error('[Sync][syncBothSides] Sync failed:', error);
      result.success = false;
      result.message = 'Sync failed';
      result.details.push(error.message);
    }

    return result;
  },

  /**
   * Upload local changes - local-first push to cloud
   * Enforces dependency ordering: vehicles -> fillups -> maintenance -> trips
   */
  async uploadLocalChanges(userId) {
    console.log('[Sync][uploadLocalChanges] Starting local-first upload with dependency ordering');
    const result = {
      success: false,
      action: 'upload-local',
      message: '',
      details: [],
      counts: { vehicles: 0, fillups: 0, maintenance: 0, tripEstimates: 0 },
      summary: { uploaded: 0, downloaded: 0, deletedFromCloud: 0, deletedFromLocal: 0, conflictsResolved: 0 }
    };

    try {
      const detailedDiff = await this.getDetailedSyncDiff(userId);
      
      // Enforce dependency ordering: vehicles must be uploaded before fillups
      const entities = [
        { key: 'vehicles', type: 'vehicle', dependsOn: [] },
        { key: 'fillups', type: 'fillup', dependsOn: ['vehicles'] },
        { key: 'maintenance', type: 'maintenance', dependsOn: ['vehicles'] },
        { key: 'tripEstimates', type: 'trip', dependsOn: ['vehicles'] }
      ];

      console.log('[Sync][uploadLocalChanges] Processing entities in dependency order');
      
      for (const ent of entities) {
        console.log(`[Sync][uploadLocalChanges] Processing ${ent.key} (depends on: ${ent.dependsOn.join(', ') || 'none'})`);
        const diff = detailedDiff.entities[ent.key];
        const applyResult = await this.applyDiff(diff, 'upload-local', ent.type, userId);
        
        result.summary.uploaded += applyResult.uploaded;
        result.summary.deletedFromCloud += applyResult.deletedFromCloud;
        result.summary.conflictsResolved += applyResult.conflictsResolved;
        result.counts[ent.key] = applyResult.uploaded;
        result.details.push(...applyResult.errors);
        
        console.log(`[Sync][uploadLocalChanges] Completed ${ent.key}: ${applyResult.uploaded} uploaded, ${applyResult.errors.length} errors`);
      }

      result.success = result.details.length === 0;
      result.message = result.success 
        ? `Upload complete: ${result.summary.uploaded} records uploaded.`
        : 'Upload completed with errors';
    } catch (error) {
      console.error('[Sync][uploadLocalChanges] Upload failed:', error);
      result.success = false;
      result.message = 'Upload failed';
      result.details.push(error.message);
    }

    return result;
  },

  /**
   * Replace local data with cloud data - cloud-first pull
   */
  async replaceLocalWithCloud(userId) {
    console.log('[Sync][replaceLocalWithCloud] Starting cloud-first replacement');
    const result = {
      success: false,
      action: 'replace-local',
      message: '',
      details: [],
      counts: { vehicles: 0, fillups: 0, maintenance: 0, tripEstimates: 0 },
      summary: { uploaded: 0, downloaded: 0, deletedFromCloud: 0, deletedFromLocal: 0, conflictsResolved: 0 }
    };

    try {
      const detailedDiff = await this.getDetailedSyncDiff(userId);
      const entities = [
        { key: 'vehicles', type: 'vehicle' },
        { key: 'fillups', type: 'fillup' },
        { key: 'maintenance', type: 'maintenance' },
        { key: 'tripEstimates', type: 'trip' }
      ];

      for (const ent of entities) {
        const diff = detailedDiff.entities[ent.key];
        const applyResult = await this.applyDiff(diff, 'replace-local', ent.type, userId);
        
        result.summary.downloaded += applyResult.downloaded;
        result.summary.deletedFromLocal += applyResult.deletedFromLocal;
        result.summary.conflictsResolved += applyResult.conflictsResolved;
        result.counts[ent.key] = applyResult.downloaded;
        result.details.push(...applyResult.errors);
      }

      result.success = result.details.length === 0;
      result.message = result.success 
        ? `Replacement complete: ${result.summary.downloaded} records downloaded.`
        : 'Replacement completed with errors';
    } catch (error) {
      console.error('[Sync][replaceLocalWithCloud] Replacement failed:', error);
      result.success = false;
      result.message = 'Replacement failed';
      result.details.push(error.message);
    }

    return result;
  },


  /**
   * Merge two fill-up records intelligently (last writer wins per field)
   * @param {Object} local - Local fill-up record
   * @param {Object} cloud - Cloud fill-up record
   * @returns {Object} Merged record
   */
  mergeFillupRecords(local, cloud) {
    const merged = { ...local };
    const localTime = new Date(local.updatedAt || local.timestamp).getTime();
    const cloudTime = new Date(cloud.updated_at || cloud.created_at).getTime();
    
    // Field mapping between local and cloud names
    const fieldMap = {
      odometer: 'odometer',
      liters: 'liters',
      pricePerLiter: 'price_per_liter',
      totalCost: 'total_cost',
      station: 'station',
      notes: 'notes',
      fullTank: 'full_tank'
    };
    
    // For each field, use the version with later timestamp
    Object.entries(fieldMap).forEach(([localField, cloudField]) => {
      const localValue = local[localField];
      const cloudValue = cloud[cloudField];
      
      if (localValue !== cloudValue) {
        merged[localField] = localTime > cloudTime ? localValue : cloudValue;
      }
    });
    
    // Set updated_at to the later timestamp
    merged.updatedAt = localTime > cloudTime ? (local.updatedAt || local.timestamp) : (cloud.updated_at || cloud.created_at);
    
    return merged;
  },

  /**
   * Store unresolved conflict for later resolution
   * @param {Object} conflict - Conflict object
   * @returns {void}
   */
  storeUnresolvedConflict(conflict) {
    const unresolved = JSON.parse(localStorage.getItem('fueltracker-unresolved-conflicts') || '[]');
    unresolved.push({
      id: conflict.id,
      type: 'fillup',
      local: conflict.local,
      cloud: conflict.cloud,
      detectedAt: new Date().toISOString()
    });
    localStorage.setItem('fueltracker-unresolved-conflicts', JSON.stringify(unresolved));
    console.log('[Sync][resolveConflict] Stored unresolved conflict:', conflict.id);
  },

  /**
   * Get unresolved conflicts from localStorage
   * @returns {Array} Array of unresolved conflicts
   */
  getUnresolvedConflicts() {
    return JSON.parse(localStorage.getItem('fueltracker-unresolved-conflicts') || '[]');
  },

  /**
   * Apply user resolutions to conflicts and sync non-conflict changes
  /**
   * Apply user-selected conflict resolutions and automatic changes
   * @param {Object} resolutions - Map of stableKey -> chosenResolution
   * @param {Array} conflicts - List of conflict objects
   * @param {Object} nonConflicts - Non-conflict diff categories
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result summary
   */
  async applyResolutions(resolutions, conflicts, nonConflicts, userId) {
    console.log(`[Sync][applyResolutions] Starting with userId: ${userId}`);
    
    // Validate userId before proceeding
    if (!userId) {
      const error = 'userId is required but was undefined in applyResolutions';
      console.error(`[Sync][applyResolutions] Validation failed: ${error}`);
      console.error(`[Sync][applyResolutions] Caller: ${new Error().stack}`);
      throw new Error(error);
    }
    if (!this.isValidUuid(userId)) {
      const error = `userId is not a valid UUID in applyResolutions: ${userId}`;
      console.error(`[Sync][applyResolutions] Validation failed: ${error}`);
      throw new Error(error);
    }

    const result = {
      resolved: 0,
      skipped: 0,
      uploaded: 0,
      downloaded: 0,
      errors: []
    };
    
    try {
      // 1. Repair record lookup: Use the provided conflicts array
      for (const [recordId, resolution] of Object.entries(resolutions)) {
        const conflict = conflicts.find(c => {
          const cLocal = c.local || {};
          return (cLocal.stableKey || cLocal.id) === recordId || String(cLocal.id) === String(recordId);
        });
        
        if (!conflict) {
          console.warn('[Sync][applyResolutions] Conflict not found for record:', recordId);
          continue;
        }
        
        if (resolution === 'skip') {
          result.skipped++;
        } else {
          try {
            await this.resolveSingleConflict(conflict, resolution, userId);
            result.resolved++;
          } catch (err) {
            result.errors.push(`Failed to resolve ${recordId}: ${err.message}`);
          }
        }
      }
      
      // 2. Apply non-conflict changes automatically
      const entities = [
        { key: 'vehicles', type: 'vehicle' },
        { key: 'fillups', type: 'fillup' },
        { key: 'maintenance', type: 'maintenance' },
        { key: 'tripEstimates', type: 'trip' }
      ];

      for (const ent of entities) {
        const diff = nonConflicts.entities?.[ent.key];
        if (!diff) continue;

        const applyResult = await this.applyDiff(diff, 'sync-both', ent.type, userId);
        result.uploaded += applyResult.uploaded;
        result.downloaded += applyResult.downloaded;
        if (applyResult.errors) result.errors.push(...applyResult.errors);
      }
      
      return result;
    } catch (error) {
      console.error('[Sync][applyResolutions] Global error:', error);
      result.errors.push(error.message);
    }
  },

  /**
   * Resolve a single conflict for any entity
   */
  async resolveSingleConflict(conflict, resolution, userId) {
    console.log(`[Sync][resolveSingleConflict] Resolving conflict with resolution: ${resolution}, userId: ${userId}`);
    
    // Validate userId before proceeding
    if (!userId) {
      const error = 'userId is required but was undefined in resolveSingleConflict';
      console.error(`[Sync][resolveSingleConflict] Validation failed: ${error}`);
      console.error(`[Sync][resolveSingleConflict] Caller: ${new Error().stack}`);
      throw new Error(error);
    }
    if (!this.isValidUuid(userId)) {
      const error = `userId is not a valid UUID in resolveSingleConflict: ${userId}`;
      console.error(`[Sync][resolveSingleConflict] Validation failed: ${error}`);
      throw new Error(error);
    }

    const { local, cloud, type } = conflict;
    
    switch (resolution) {
      case 'keep-local':
        await this.uploadSingle(local, type, userId);
        break;
      case 'keep-cloud':
        this.downloadSingle(cloud, type);
        break;
      case 'merge-auto':
        // For now, auto-merge is just keep newer, but we could do field-level later
        const localTime = new Date(local.updatedAt || local.updated_at || local.timestamp).getTime();
        const cloudTime = new Date(cloud.updated_at || cloud.created_at).getTime();
        if (localTime >= cloudTime) {
          await this.uploadSingle(local, type, userId);
        } else {
          this.downloadSingle(cloud, type);
        }
        break;
    }
  },

  /**
   * Find conflict by ID in diff
   * @param {string} conflictId - Conflict ID
   * @param {Object} diff - Diff object
   * @returns {Object|null} Conflict object or null
   */
  findConflictById(conflictId, diff) {
    return diff.bothChanged.find(c => c.local.id === conflictId || c.cloud.id === conflictId) || null;
  },

  /**
   * Process queued background sync when online
   * This is called when connectivity is restored
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async processQueuedSync(userId) {
    const lock = localStorage.getItem(BACKGROUND_SYNC_LOCK_KEY);
    if (!lock) {
      return;
    }

    console.log('[Sync][background] Processing queued sync');
    localStorage.removeItem(BACKGROUND_SYNC_LOCK_KEY);
    await this.syncAfterMutation(userId);
  }
};
