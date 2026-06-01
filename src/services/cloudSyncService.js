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

// Store online listener reference to prevent duplicates
let onlineListener = null;

export const cloudSyncService = {
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
    
    return {
      ...localSummary,
      ...cloudSummary
    };
  },

  /**
   * Upload local data to cloud
   */
  async uploadLocalDataToCloud(userId) {
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

      const vehicles = JSON.parse(localStorage.getItem('fueltracker-vehicles-v2') || '[]');
      const fillups = JSON.parse(localStorage.getItem('fueltracker-fillups-v2') || '[]');
      const maintenance = JSON.parse(localStorage.getItem('fueltracker-maintenance-entries-v3') || '[]');
      const tripEstimates = JSON.parse(localStorage.getItem('fueltracker-trip-estimates-v2') || '[]');

      result.details.push(`Local records found: ${vehicles.length} vehicles, ${fillups.length} fillups, ${maintenance.length} maintenance, ${tripEstimates.length} trips`);

      let vehicleErrors = 0;
      let fillupErrors = 0;
      let maintenanceErrors = 0;
      let tripErrors = 0;

      // Upload vehicles
      if (vehicles.length > 0) {
        for (const vehicle of vehicles) {
          const { error } = await supabase.from('vehicles').upsert({
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
          if (error) {
            vehicleErrors++;
            result.details.push(`Vehicle upload failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.vehicles++;
          }
        }
      }

      // Upload fillups
      if (fillups.length > 0) {
        for (const fillup of fillups) {
          const { error } = await supabase.from('fillups').upsert({
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
            created_at: fillup.timestamp || new Date().toISOString()
          });
          if (error) {
            fillupErrors++;
            result.details.push(`Fillup upload failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.fillups++;
          }
        }
      }

      // Upload maintenance
      if (maintenance.length > 0) {
        for (const entry of maintenance) {
          const { error } = await supabase.from('maintenance').upsert({
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
          if (error) {
            maintenanceErrors++;
            result.details.push(`Maintenance upload failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.maintenance++;
          }
        }
      }

      // Upload trip estimates
      if (tripEstimates.length > 0) {
        for (const estimate of tripEstimates) {
          const { error } = await supabase.from('trip_estimates').upsert({
            id: estimate.id || uuidv4(),
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

      if (totalErrors === 0 && totalRecords > 0) {
        result.success = true;
        result.message = `Upload complete. ${totalRecords} records saved to your cloud account.`;
        result.details.push(`Successfully uploaded: ${result.counts.vehicles} vehicles, ${result.counts.fillups} fillups, ${result.counts.maintenance} maintenance, ${result.counts.tripEstimates} trips`);
        localStorage.setItem(MIGRATION_DECISION_KEY, 'upload');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      } else if (totalRecords > 0) {
        result.success = false;
        result.message = `Upload partially succeeded. ${totalRecords} records uploaded, ${totalErrors} failed.`;
        result.details.push(`Partial success: ${totalRecords} uploaded, ${totalErrors} failed`);
      } else {
        result.success = false;
        result.message = 'Upload failed. No records were saved to the cloud.';
        result.details.push('All upload operations failed or no data to upload');
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = 'Upload failed due to an unexpected error.';
      result.details.push(`Exception: ${error.message}`);
      return result;
    }
  },

  /**
   * Download cloud data to local (overwrites local)
   */
  async downloadCloudDataToLocal(userId) {
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

      // Fetch vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId);
      
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
          tyreSize: null
        }));
        localStorage.setItem('fueltracker-vehicles-v2', JSON.stringify(mappedVehicles));
        result.counts.vehicles = mappedVehicles.length;
      }

      // Fetch fillups
      const { data: fillups, error: fillupsError } = await supabase
        .from('fillups')
        .select('*')
        .eq('user_id', userId)
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

      // Fetch maintenance
      const { data: maintenance, error: maintenanceError } = await supabase
        .from('maintenance')
        .select('*')
        .eq('user_id', userId)
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

      const totalRecords = result.counts.vehicles + result.counts.fillups + result.counts.maintenance;
      const hasErrors = result.details.some(d => d.includes('failed'));

      if (!hasErrors && totalRecords > 0) {
        result.success = true;
        result.message = `Download complete. ${totalRecords} records loaded from your cloud account.`;
        result.details.push(`Successfully downloaded: ${result.counts.vehicles} vehicles, ${result.counts.fillups} fillups, ${result.counts.maintenance} maintenance`);
        localStorage.setItem(MIGRATION_DECISION_KEY, 'download');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      } else if (totalRecords > 0) {
        result.success = false;
        result.message = `Download partially succeeded. ${totalRecords} records loaded, some operations failed.`;
      } else {
        result.success = false;
        result.message = 'Download failed. No records were loaded from the cloud.';
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = 'Download failed due to an unexpected error.';
      result.details.push(`Exception: ${error.message}`);
      return result;
    }
  },

  /**
   * Merge local data to cloud (dedupe by ID where possible)
   */
  async mergeLocalDataToCloud(userId) {
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

      // Get existing cloud data to avoid duplicates
      const { data: existingVehicles, error: vehiclesFetchError } = await supabase.from('vehicles').select('id').eq('user_id', userId);
      const { data: existingFillups, error: fillupsFetchError } = await supabase.from('fillups').select('id').eq('user_id', userId);
      const { data: existingMaintenance, error: maintenanceFetchError } = await supabase.from('maintenance').select('id').eq('user_id', userId);
      const { data: existingTripEstimates, error: tripsFetchError } = await supabase.from('trip_estimates').select('id').eq('user_id', userId);

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

      let vehicleErrors = 0;
      let fillupErrors = 0;
      let maintenanceErrors = 0;
      let tripErrors = 0;
      let skipped = 0;

      // Upload vehicles (skip existing)
      for (const vehicle of vehicles) {
        const vehicleId = vehicle.id || uuidv4();
        if (!existingVehicleIds.has(vehicleId)) {
          const { error } = await supabase.from('vehicles').upsert({
            id: vehicleId,
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
          if (error) {
            vehicleErrors++;
            result.details.push(`Vehicle merge failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.vehicles++;
          }
        } else {
          skipped++;
        }
      }

      // Upload fillups (skip existing)
      for (const fillup of fillups) {
        const fillupId = fillup.id || uuidv4();
        if (!existingFillupIds.has(fillupId)) {
          const { error } = await supabase.from('fillups').upsert({
            id: fillupId,
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
            created_at: fillup.timestamp || new Date().toISOString()
          });
          if (error) {
            fillupErrors++;
            result.details.push(`Fillup merge failed: ${error.message} (code: ${error.code})`);
          } else {
            result.counts.fillups++;
          }
        } else {
          skipped++;
        }
      }

      // Upload maintenance (skip existing)
      for (const entry of maintenance) {
        const entryId = entry.id || uuidv4();
        if (!existingMaintenanceIds.has(entryId)) {
          const { error } = await supabase.from('maintenance').upsert({
            id: entryId,
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
      for (const estimate of tripEstimates) {
        const estimateId = estimate.id || uuidv4();
        if (!existingTripEstimateIds.has(estimateId)) {
          const { error } = await supabase.from('trip_estimates').upsert({
            id: estimateId,
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
        localStorage.setItem(MIGRATION_DECISION_KEY, 'merge');
        localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      } else if (totalMerged > 0) {
        result.success = false;
        result.message = `Merge partially succeeded. ${totalMerged} records merged, ${totalErrors} failed.`;
      } else {
        result.success = false;
        result.message = 'Merge failed. No records were merged.';
      }

      return result;
    } catch (error) {
      result.success = false;
      result.message = 'Merge failed due to an unexpected error.';
      result.details.push(`Exception: ${error.message}`);
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
            created_at: fillup.timestamp || new Date().toISOString()
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
    try {
      const userId = await this.getUserId();
      if (!userId) {
        return null;
      }

      // Check if migration decision was already made
      const migrationDecision = localStorage.getItem(MIGRATION_DECISION_KEY);
      const migrationComplete = localStorage.getItem(MIGRATION_FLAG_KEY);

      if (migrationComplete && migrationDecision) {
        // Safeguard: If decision was 'download' but local data now exists (e.g., from import),
        // show modal again to let user decide whether to preserve the imported data
        if (migrationDecision === 'download') {
          const localData = this.hasLocalData();
          if (localData.hasData) {
            // Local data appeared after download decision - likely from import
            // Clear decision and show modal to protect imported data
            localStorage.removeItem(MIGRATION_DECISION_KEY);
            localStorage.removeItem(MIGRATION_FLAG_KEY);
            const syncStatus = await this.getSyncStatus(userId);
            return syncStatus;
          }
        }
        
        // Setup online listener that respects the decision
        this.setupOnlineSyncListener(userId, { decision: migrationDecision });

        // Sync behavior depends on stored decision
        if (migrationDecision === 'keep-local') {
          // No syncFromCloud call - preserve local data as-is
        } else {
          // For upload, download, merge: normal sync is safe
          if (this.isOnline()) {
            await this.syncFromCloud(userId);
            await this.processQueue(userId);
          }
        }
        return null; // No migration needed
      }

      // Get sync status to determine if migration modal is needed
      const syncStatus = await this.getSyncStatus(userId);
      
      // Always return sync status for UI to show migration modal
      // Never auto-download or auto-set migration decision
      // User must explicitly choose a migration action
      return syncStatus;
    } catch (error) {
      // Always return cleanly, never hang
      return null;
    }
  },

  /**
   * Continue sync after migration decision
   * Branches by decision to ensure safety
   */
  async continueSyncAfterDecision(userId, decision) {
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
          // Upload local data first, then sync from cloud to align
          if (this.isOnline()) {
            await this.syncFromCloud(userId);
            await this.processQueue(userId);
          }
          result.message = 'Sync continued after upload.';
          break;

        case 'download':
          // User explicitly chose to overwrite local with cloud
          if (this.isOnline()) {
            await this.syncFromCloud(userId);
            await this.processQueue(userId);
          }
          result.message = 'Sync continued after download.';
          break;

        case 'merge':
          // Merge already happened, sync from cloud to refresh local state
          if (this.isOnline()) {
            await this.syncFromCloud(userId);
            await this.processQueue(userId);
          }
          result.message = 'Sync continued after merge.';
          break;

        case 'keep-local':
          // CRITICAL: Do NOT call syncFromCloud - preserve local data as-is
          // Do NOT overwrite localStorage from cloud
          // Skip queue processing to be safe
          result.message = 'Local data preserved. Cloud sync disabled.';
          break;

        default:
          result.success = false;
          result.message = 'Unknown migration decision.';
          break;
      }
    } catch (error) {
      result.success = false;
      result.message = 'Sync continuation failed.';
      result.details.push(`Exception: ${error.message}`);
    }

    return result;
  }
};
