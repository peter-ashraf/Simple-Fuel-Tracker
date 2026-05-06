import { formatTo2Decimals } from './formatting';
import { differenceInDays } from 'date-fns';

export function calculateTripMetrics(fillUps, index) {
  const current = fillUps[index];
  const previous = index > 0 ? fillUps[index - 1] : null;

  const distance = previous ? current.odometer - previous.odometer : 0;
  let fuelConsumed = current.liters;
  let isEstimated = false;

  if (current.tankCapacityLiters > 0) {
    const prevLevel = previous?.tankLevelAfter !== undefined ? previous.tankLevelAfter : 100;
    const currLevel = current.tankLevelAfter !== undefined ? current.tankLevelAfter : 100;
    
    if (prevLevel < 100 || currLevel < 100) {
       fuelConsumed = (prevLevel / 100 * current.tankCapacityLiters) + current.liters - (currLevel / 100 * current.tankCapacityLiters);
       isEstimated = true;
    }
  }

  // Ensure fuelConsumed doesn't go below 0 due to gauge inaccuracy
  if (fuelConsumed <= 0 && current.liters > 0 && distance > 0) {
    fuelConsumed = current.liters; // fallback
  }

  const kmPerLiter = distance > 0 && fuelConsumed > 0 ? distance / fuelConsumed : 0;
  const litersPer100km = distance > 0 && fuelConsumed > 0 ? (fuelConsumed / distance) * 100 : 0;
  const tripCost = current.liters * current.pricePerLiter;

  return {
    distance: formatTo2Decimals(distance),
    kmPerLiter: formatTo2Decimals(kmPerLiter),
    litersPer100km: formatTo2Decimals(litersPer100km),
    tripCost: formatTo2Decimals(tripCost),
    isEstimated
  };
}

/**
 * Calculate average daily driving distance from fill-up history
 * @param {Array} fillUps - Array of fill-up objects with timestamp and odometer
 * @returns {number} Average daily distance in km, or 0 if insufficient data
 */
export function calculateAverageDailyDistance(fillUps) {
  if (!fillUps || fillUps.length < 2) return 0;
  
  // Sort by date
  const sorted = [...fillUps].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const firstFillUp = sorted[0];
  const lastFillUp = sorted[sorted.length - 1];
  
  const totalDistance = lastFillUp.odometer - firstFillUp.odometer;
  const totalDays = differenceInDays(
    new Date(lastFillUp.timestamp),
    new Date(firstFillUp.timestamp)
  );
  
  if (totalDays <= 0) return 0;
  
  return formatTo2Decimals(totalDistance / totalDays);
}

/**
 * Predict when maintenance will be due based on driving patterns
 * @param {Object} reminder - Maintenance reminder with nextDueODO
 * @param {number} currentOdometer - Current odometer reading
 * @param {number} avgDailyDistance - Average daily driving distance
 * @returns {Object|null} Prediction with days remaining and projected date, or null if can't predict
 */
export function predictMaintenanceDueDate(reminder, currentOdometer, avgDailyDistance) {
  // Only predict for odometer-based reminders
  if (!reminder.nextDueODO || !avgDailyDistance || avgDailyDistance <= 0) {
    return null;
  }
  
  const kmRemaining = reminder.nextDueODO - currentOdometer;
  
  if (kmRemaining <= 0) {
    // Already due
    return {
      daysRemaining: 0,
      projectedDate: new Date(),
      isOverdue: true,
      kmRemaining: 0
    };
  }
  
  const daysRemaining = Math.ceil(kmRemaining / avgDailyDistance);
  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + daysRemaining);
  
  return {
    daysRemaining,
    projectedDate,
    isOverdue: false,
    kmRemaining: formatTo2Decimals(kmRemaining)
  };
}

/**
 * Format prediction for display
 * @param {Object} prediction - Prediction object from predictMaintenanceDueDate
 * @returns {string} Human-readable prediction text
 */
export function formatPrediction(prediction) {
  if (!prediction) return null;
  
  if (prediction.isOverdue) {
    return 'Due now';
  }
  
  const { daysRemaining, projectedDate } = prediction;
  const dateStr = projectedDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  if (daysRemaining <= 1) {
    return `Due tomorrow (${dateStr})`;
  } else if (daysRemaining <= 7) {
    return `Due in ${daysRemaining} days (${dateStr})`;
  } else if (daysRemaining <= 30) {
    const weeks = Math.ceil(daysRemaining / 7);
    return `Due in ~${weeks} weeks (${dateStr})`;
  } else {
    const months = Math.ceil(daysRemaining / 30);
    return `Due in ~${months} months (${dateStr})`;
  }
}
