import { useState } from 'react';
import { Activity, TrendingUp, DollarSign, Fuel, Wrench, AlertTriangle, Bell, Settings, Route, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, MetricCard, PageWrapper, Modal } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { calculateTripMetrics, calculateAverageDailyDistance, formatPrediction } from '../utils/calculations';
import { formatTo2Decimals, formatCurrency2Dec, formatEfficiency2Dec } from '../utils/formatting';
import { getMaintenanceCategory } from '../data/maintenanceCategories';

export default function Dashboard() {
  const { stats, activeVehicleFillUps, maintenanceEntries, maintenanceSettings } = useFuel();
  const [predictedModalOpen, setPredictedModalOpen] = useState(false);
  const recentTrips = [...activeVehicleFillUps].reverse().slice(0, 5);
  
  // Calculate total maintenance cost (we can't easily do this from unified entries yet if cost isn't there, but let's keep it for compatibility if we add cost later)
  const totalMaintenanceCost = stats.maintenanceCost || 0;
  
  // Get current odometer
  const currentOdometer = activeVehicleFillUps.length > 0 
    ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
    : 0;
  
  // Check maintenance alerts
  const getMaintenanceAlerts = () => {
    if (!maintenanceEntries?.length || currentOdometer === 0) return [];
    
    return maintenanceEntries
      .filter(entry => {
        // Check if category is enabled
        const categorySettings = maintenanceSettings?.categorySettings?.[entry.type];
        if (categorySettings?.enabled === false) return false;
        
        return entry.nextDueODO && entry.alertODO;
      })
      .map(entry => {
        let status = 'ok';
        if (currentOdometer >= entry.nextDueODO) {
          status = 'critical';
        } else if (currentOdometer >= entry.alertODO) {
          status = 'warning';
        }
        
        const category = getMaintenanceCategory(entry.type);
        const remainingKm = Math.max(0, entry.nextDueODO - currentOdometer);
        
        return {
          ...entry,
          status,
          categoryName: category.name,
          categoryColor: category.color,
          remainingKm
        };
      })
      .filter(item => item.status !== 'ok')
      .sort((a, b) => a.remainingKm - b.remainingKm)
      .slice(0, 3); // Show top 3 most urgent
  };
  
  const maintenanceAlerts = getMaintenanceAlerts();
  
  // Calculate driving patterns for predictions
  const avgDailyDistance = calculateAverageDailyDistance(activeVehicleFillUps);
  
  // Get upcoming maintenance with predictions
  const getUpcomingMaintenance = () => {
    if (!maintenanceEntries?.length || currentOdometer === 0 || avgDailyDistance <= 0) return [];
    
    return maintenanceEntries
      .filter(entry => {
        const categorySettings = maintenanceSettings?.categorySettings?.[entry.type];
        if (categorySettings?.enabled === false) return false;
        return entry.nextDueODO && currentOdometer < entry.nextDueODO;
      })
      .map(entry => {
        const kmRemaining = entry.nextDueODO - currentOdometer;
        const daysRemaining = Math.ceil(kmRemaining / avgDailyDistance);
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + daysRemaining);
        const category = getMaintenanceCategory(entry.type);
        
        return {
          ...entry,
          categoryName: category.name,
          categoryColor: category.color,
          kmRemaining,
          daysRemaining,
          projectedDate
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 3);
  };
  
  const upcomingMaintenance = getUpcomingMaintenance();

  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === 0) return "text-slate-500 dark:text-slate-400";
    if (kmPerL > 12) return "text-emerald-600 dark:text-emerald-500";
    if (kmPerL >= 8) return "text-amber-600 dark:text-amber-500";
    return "text-red-600 dark:text-red-500";
  };
  
  const avgKmL = stats.avgKmPerLiter > 0 ? formatTo2Decimals(stats.avgKmPerLiter).toFixed(2) : "-";
  const avgL100 = stats.avgL100km > 0 ? formatTo2Decimals(stats.avgL100km).toFixed(2) : "-";

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] overflow-hidden">
      <PageWrapper className="flex-1 flex flex-col min-h-0 space-y-6">
        <div className="flex-shrink-0">
          {/* Header - minimal, clear */}
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Overview</h1>
          </div>

          {/* Metrics Grid */}
          <section className="grid grid-cols-2 gap-3 mb-6">
            <MetricCard variant="default" className="flex flex-col justify-between min-h-[120px] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3 h-3 text-emerald-500 dark:text-emerald-400 neon-glow" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">Avg Km/L</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl font-bold tracking-tighter ${getEfficiencyColorStatus(stats.avgKmPerLiter)}`}>{avgKmL}</span>
              </div>
            </MetricCard>

            <MetricCard variant="secondary" className="flex flex-col justify-between min-h-[120px] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-blue-500 dark:text-blue-400 neon-glow-blue" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">L/100km</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{avgL100}</span>
              </div>
            </MetricCard>

            <MetricCard variant="default" className="flex flex-col justify-between min-h-[120px] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">Total Cost</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatCurrency2Dec(stats.totalCost, '').replace('L.E ', '')}</span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">EGP</span>
              </div>
            </MetricCard>

            <MetricCard variant="secondary" className="flex flex-col justify-between min-h-[120px] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Fuel className="w-3 h-3 text-amber-500 dark:text-amber-400 neon-glow-amber" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">Fill-ups</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{stats.totalFillUps}</span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">trips</span>
              </div>
            </MetricCard>
          </section>

          {/* Maintenance Alerts / Predictions simplified for fixed screen */}
          {(maintenanceAlerts.length > 0 || upcomingMaintenance.length > 0) && (
            <div className="grid grid-cols-1 gap-2 mb-6">
              {maintenanceAlerts.length > 0 && (
                 <Link to="/maintenance" className="w-full flex items-center justify-between p-3 bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 rounded-2xl">
                    <div className="flex items-center gap-2">
                       <Bell className="w-4 h-4 text-red-500" />
                       <span className="text-xs font-bold text-red-600 dark:text-red-400">{maintenanceAlerts.length} Urgent Maintenance!</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-red-400" />
                 </Link>
              )}
              {upcomingMaintenance.length > 0 && (
                <button 
                  onClick={() => setPredictedModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 rounded-2xl"
                >
                  <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Predicted: {upcomingMaintenance[0].categoryName}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recent Trips - Scrollable portion */}
        <section className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Recent Trips</h2>
            <Link to="/history" className="text-xs font-medium text-emerald-500 dark:text-emerald-400">View All</Link>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
            {recentTrips.length === 0 ? (
              <div className="text-center py-10 px-6 bg-slate-100 dark:bg-white/[0.03] rounded-3xl">
                <Fuel className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No recent trips.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {activeVehicleFillUps.slice().reverse().map((fill) => {
                  const originalIndex = activeVehicleFillUps.findIndex(f => f.id === fill.id);
                  const metrics = calculateTripMetrics(activeVehicleFillUps, originalIndex);
                  return (
                    <li key={fill.id} className="bg-white dark:bg-white/[0.03] rounded-2xl p-4 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`w-1 h-6 rounded-full ${metrics.distance > 0 ? (metrics.kmPerLiter > 12 ? 'bg-emerald-500' : metrics.kmPerLiter >= 8 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-600'}`}></div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{format(new Date(fill.timestamp), 'MMM d')}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{fill.odometer.toLocaleString()} km</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency2Dec(metrics.tripCost, '').replace('L.E ', '')} <span className="text-[10px] text-slate-500">EGP</span></p>
                        <p className={`text-[10px] font-bold mt-0.5 ${getEfficiencyColorStatus(metrics.kmPerLiter)}`}>{formatEfficiency2Dec(metrics.kmPerLiter)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <Modal isOpen={predictedModalOpen} onClose={() => setPredictedModalOpen(false)} title="Upcoming Maintenance">
          <div className="space-y-2 p-1">
             {upcomingMaintenance.map((item) => (
                <div key={item.id} className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                   <div className="flex items-center gap-3">
                      <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: item.categoryColor }} />
                      <div className="flex-1">
                         <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{item.categoryName}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.daysRemaining <= 7 ? `Due in ${item.daysRemaining} days` : `Due in ~${Math.ceil(item.daysRemaining / 7)} weeks`}
                            <span className="text-slate-400 mx-1">•</span> {item.kmRemaining.toLocaleString()} km left
                         </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{format(item.projectedDate, 'MMM d')}</p>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        </Modal>
      </PageWrapper>
    </div>
  );
}
