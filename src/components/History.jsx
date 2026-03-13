import { Trash2, Fuel, Calendar, MapPin } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { PageWrapper } from './ui';

export default function History() {
  const { activeVehicleFillUps, deleteFillUp } = useFuel();
  
  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === 0) return "text-slate-400";
    if (kmPerL > 12) return "text-emerald-500";
    if (kmPerL >= 8) return "text-amber-500";
    return "text-red-500";
  };

  const reversedTrips = [...activeVehicleFillUps].reverse();

  return (
    <PageWrapper>
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
        <ul className="space-y-4">
          {reversedTrips.map((fill) => {
            const originalIndex = activeVehicleFillUps.findIndex(f => f.id === fill.id);
            const metrics = calculateTripMetrics(activeVehicleFillUps, originalIndex);
            
            const kmPerLiter = metrics.kmPerLiter > 0 ? metrics.kmPerLiter.toFixed(2) : "-";
            const litersPer100km = metrics.litersPer100km > 0 ? metrics.litersPer100km.toFixed(2) : "-";
            const tripCost = metrics.tripCost.toFixed(2);
            
            return (
              <li key={fill.id} className="bg-white/80 dark:bg-card/80 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl rounded-[1.5rem] p-5 relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-200 dark:bg-slate-800">
                   <div className={`h-full w-full ${metrics.distance > 0 ? (metrics.kmPerLiter > 12 ? 'bg-emerald-500' : metrics.kmPerLiter >= 8 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-400 dark:bg-slate-600'}`}></div>
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                       <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                         {format(new Date(fill.timestamp), 'MMM d, yyyy')}
                       </p>
                       <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">P{fill.fuelType || '92'}</span>
                    </div>
                    {fill.station && (
                      <p className="text-xs font-medium text-emerald-400 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3"/> {fill.station}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {fill.odometer.toLocaleString()} km
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight">{tripCost} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase">EGP</span></p>
                    <p className="text-[11px] text-slate-500">
                      {fill.liters} L @ {fill.pricePerLiter}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 grid grid-cols-3 gap-2 border border-slate-200 dark:border-slate-800/50 shrink-0 relative">
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Dist</p>
                    <p className="text-sm font-semibold text-slate-200">{metrics.distance > 0 ? `+${metrics.distance}` : "-"}</p>
                  </div>
                  <div className="text-center border-l border-r border-slate-200 dark:border-slate-800/50">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Km/L</p>
                    <p className={`text-sm font-bold ${getEfficiencyColorStatus(metrics.kmPerLiter)}`}>{kmPerLiter}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">L/100</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{litersPer100km}</p>
                  </div>
                </div>
                
                {fill.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 italic bg-slate-100 dark:bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800/50">"{fill.notes}"</p>
                )}

                <button 
                  onClick={() => {
                     if(confirm("Delete this fill-up entry?")) deleteFillUp(fill.id);
                  }}
                  className="absolute bottom-4 right-4 p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity desktop-hover shadow-sm dark:shadow-none"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {/* Always show delete on mobile */}
                <button 
                  onClick={() => {
                     if(confirm("Delete this fill-up entry?")) deleteFillUp(fill.id);
                  }}
                  className="absolute bottom-4 right-4 p-2 text-slate-500 hover:text-red-400 transition-colors md:hidden"
                  aria-label="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PageWrapper>
  );
}
