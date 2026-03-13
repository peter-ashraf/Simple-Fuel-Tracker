import { Activity, TrendingUp, DollarSign, Fuel } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, PageWrapper } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { calculateTripMetrics } from '../utils/calculations';

export default function Dashboard() {
  const { stats, activeVehicleFillUps } = useFuel();
  const recentTrips = [...activeVehicleFillUps].reverse().slice(0, 5);

  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === 0) return "text-slate-400";
    if (kmPerL > 12) return "text-emerald-500";
    if (kmPerL >= 8) return "text-amber-500";
    return "text-red-500";
  };

  const avgKmL = stats.avgKmPerLiter > 0 ? stats.avgKmPerLiter.toFixed(2) : "-";
  const avgL100 = stats.avgL100km > 0 ? stats.avgL100km.toFixed(1) : "-";

  return (
    <PageWrapper className="space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Overview</h1>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col justify-between group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 blur-2xl rounded-full"></div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Km/L</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-bold tracking-tighter ${getEfficiencyColorStatus(stats.avgKmPerLiter)}`}>{avgKmL}</span>
            {avgKmL !== "-" && <span className="text-xs text-slate-400 font-medium">km/l</span>}
          </div>
        </Card>

        <Card className="flex flex-col justify-between group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full"></div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg L/100km</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{avgL100}</span>
            {avgL100 !== "-" && <span className="text-xs text-slate-400 font-medium">L</span>}
          </div>
        </Card>

        <Card className="flex flex-col justify-between group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 blur-2xl rounded-full"></div>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total spent</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">{stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="text-xs text-slate-400 font-medium">EGP</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 blur-2xl rounded-full"></div>
          <div className="flex items-center gap-2 mb-3">
            <Fuel className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fill-ups</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{stats.totalFillUps}</span>
            <span className="text-xs text-slate-400 font-medium">trips</span>
          </div>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Trips</h2>
          <Link to="/history" className="text-xs font-medium text-emerald-400 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full transition border border-emerald-500/20">
            View All
          </Link>
        </div>

        {recentTrips.length === 0 ? (
          <div className="text-center py-10 px-6 border-2 border-dashed border-slate-300 dark:border-slate-700/50 rounded-3xl">
            <Fuel className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium tracking-tight">No recent trips.<br/>Add your first fill-up!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recentTrips.map((fill) => {
              const originalIndex = activeVehicleFillUps.findIndex(f => f.id === fill.id);
              const metrics = calculateTripMetrics(activeVehicleFillUps, originalIndex);
              
              const kmPerLiter = metrics.kmPerLiter > 0 ? metrics.kmPerLiter.toFixed(1) : "-";
              
              return (
                <li key={fill.id} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm dark:shadow-none">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-10 rounded-full ${metrics.distance > 0 ? (metrics.kmPerLiter > 12 ? 'bg-emerald-500' : metrics.kmPerLiter >= 8 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-600'}`}></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{format(new Date(fill.timestamp), 'MMM d, yyyy')}</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{fill.odometer.toLocaleString()} km</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{metrics.tripCost.toFixed(0)} <span className="text-[10px] text-slate-400">EGP</span></p>
                    <p className={`text-xs font-bold mt-0.5 ${getEfficiencyColorStatus(metrics.kmPerLiter)}`}>{kmPerLiter} <span className="text-[10px] font-medium text-slate-500">km/L</span></p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageWrapper>
  );
}
