import { Trash2, Fuel, Calendar, MapPin, Edit2, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useFuel } from '../hooks/useFuelContext';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { PageWrapper } from './ui';
import HistoryCard from './HistoryCard';

export default function History() {
  const { activeVehicleFillUps, activeVehicleFillUpsByOdometer, deleteFillUp, updateFillUp, fuelPrices } = useFuel();
  
  const reversedTrips = [...activeVehicleFillUps].reverse();

  return (
    <PageWrapper 
      className="max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none" 
      style={{ 
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">All Fill-ups</h2>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-1 bg-slate-200 dark:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-700/50">
          {activeVehicleFillUps.length} entries
        </span>
      </div>

      {activeVehicleFillUps.length === 0 ? (
        <div className="text-center py-16 px-6 border-2 border-dashed border-slate-300 dark:border-slate-700/50 rounded-3xl">
          <Fuel className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Your history is empty.</p>
        </div>
      ) : (
        <ul className="space-y-4 pb-4">
          {reversedTrips.map((fill, reversedIndex) => {
            const originalIndex = activeVehicleFillUps.length - 1 - reversedIndex;
            return (
              <li key={fill.id} className="group">
                <HistoryCard
                  fill={fill}
                  index={originalIndex}
                  totalFillUps={activeVehicleFillUps.length}
                  fillUps={activeVehicleFillUps}
                  onDelete={deleteFillUp}
                  onUpdate={updateFillUp}
                  fuelPrices={fuelPrices}
                />
              </li>
            );
          })}
        </ul>
      )}
    </PageWrapper>
  );
}
