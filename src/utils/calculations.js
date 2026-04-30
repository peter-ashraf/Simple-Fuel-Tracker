import { formatTo2Decimals } from './formatting';

export function calculateTripMetrics(fillUps, index) {
  const current = fillUps[index];
  const previous = index > 0 ? fillUps[index - 1] : null;

  const distance = previous ? current.odometer - previous.odometer : 0;
  const kmPerLiter = distance > 0 ? distance / current.liters : 0;
  const litersPer100km = distance > 0 ? (current.liters / distance) * 100 : 0;
  const tripCost = current.liters * current.pricePerLiter;

  return {
    distance: formatTo2Decimals(distance),
    kmPerLiter: formatTo2Decimals(kmPerLiter),
    litersPer100km: formatTo2Decimals(litersPer100km),
    tripCost: formatTo2Decimals(tripCost)
  };
}
