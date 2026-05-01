import { Activity, TrendingUp, DollarSign, Fuel, Wrench, AlertTriangle, Bell, Settings, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Card, MetricCard, PageWrapper } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { calculateTripMetrics, calculateAverageDailyDistance, formatPrediction } from '../utils/calculations';
import { formatTo2Decimals, formatCurrency2Dec, formatEfficiency2Dec } from '../utils/formatting';
import { getMaintenanceCategory } from '../data/maintenanceCategories';

export default function Dashboard() {
  const { stats, activeVehicleFillUps, maintenanceReminders, maintenanceSettings, maintenanceLogs } = useFuel();
  const recentTrips = [...activeVehicleFillUps].reverse().slice(0, 5);
  
  // Calculate total maintenance cost
  const totalMaintenanceCost = maintenanceLogs?.reduce((total, log) => total + (log.cost || 0), 0) || 0;
  
  // Get current odometer
  const currentOdometer = activeVehicleFillUps.length > 0 
    ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
    : 0;
  
  // Check maintenance alerts
  const getMaintenanceAlerts = () => {
    if (!maintenanceReminders?.length || currentOdometer === 0) return [];
    
    return maintenanceReminders
      .filter(reminder => {
        // Check if category is enabled
        const categorySettings = maintenanceSettings?.categorySettings?.[reminder.categoryId];
        if (categorySettings?.enabled === false) return false;
        
        // Check if odometer-based
        return reminder.nextDueODO && reminder.alertODO;
      })
      .map(reminder => {
        let status = 'ok';
        if (currentOdometer >= reminder.nextDueODO) {
          status = 'critical';
        } else if (currentOdometer >= reminder.alertODO) {
          status = 'warning';
        }
        
        const category = getMaintenanceCategory(reminder.categoryId);
        const remainingKm = Math.max(0, reminder.nextDueODO - currentOdometer);
        
        return {
          ...reminder,
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
    if (!maintenanceReminders?.length || currentOdometer === 0 || avgDailyDistance <= 0) return [];
    
    return maintenanceReminders
      .filter(reminder => {
        const categorySettings = maintenanceSettings?.categorySettings?.[reminder.categoryId];
        if (categorySettings?.enabled === false) return false;
        return reminder.nextDueODO && currentOdometer < reminder.nextDueODO;
      })
      .map(reminder => {
        const kmRemaining = reminder.nextDueODO - currentOdometer;
        const daysRemaining = Math.ceil(kmRemaining / avgDailyDistance);
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + daysRemaining);
        const category = getMaintenanceCategory(reminder.categoryId);
        
        return {
          ...reminder,
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
    <PageWrapper className="space-y-8">
      {/* Header - minimal, clear */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Overview</h1>
      </div>

      {/* Metrics Grid - Apple Health Style: Massive numbers, tiny labels */}
      <section className="grid grid-cols-2 gap-3">
        {/* First row: 2 cards */}
        <MetricCard variant="default" className="flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 neon-glow" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Avg Km/L</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-5xl font-bold tracking-tighter ${getEfficiencyColorStatus(stats.avgKmPerLiter)}`}>{avgKmL}</span>
          </div>
        </MetricCard>

        <MetricCard variant="secondary" className="flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 neon-glow-blue" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">L/100km</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tighter">{avgL100}</span>
          </div>
        </MetricCard>

        <MetricCard variant="default" className="flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Total Cost</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatCurrency2Dec(stats.totalCost, '').replace('L.E ', '')}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">EGP</span>
          </div>
        </MetricCard>

        <MetricCard variant="secondary" className="flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Fuel className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 neon-glow-amber" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Fill-ups</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tighter">{stats.totalFillUps}</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">trips</span>
          </div>
        </MetricCard>

        {totalMaintenanceCost > 0 && (
          <MetricCard variant="accent" className="flex flex-col justify-between min-h-[140px] col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Settings className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Maintenance</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatCurrency2Dec(totalMaintenanceCost, '').replace('L.E ', '')}</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">EGP</span>
            </div>
          </MetricCard>
        )}
      </section>

      {/* Maintenance Alerts Card */}
      {maintenanceAlerts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Maintenance Alerts
            </h2>
            <Link to="/maintenance/reminders" className="text-xs font-medium text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors">
              View All →
            </Link>
          </div>
          
          <div className="space-y-2">
            {maintenanceAlerts.map((alert) => (
              <div 
                key={alert.id}
                className={`rounded-2xl p-4 flex items-center justify-between ${
                  alert.status === 'critical' 
                    ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20' 
                    : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2 h-10 rounded-full"
                    style={{ backgroundColor: alert.categoryColor }}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${
                      alert.status === 'critical' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {alert.status === 'critical' ? '⚠️ ' : '⏰ '}
                      {alert.categoryName} {alert.status === 'critical' ? 'Overdue' : 'Due Soon'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {alert.status === 'critical' 
                        ? `Exceeded by ${Math.abs(alert.remainingKm).toLocaleString()} km`
                        : `${alert.remainingKm.toLocaleString()} km remaining`
                      }
                      <span className="text-slate-400 mx-1">•</span>
                      Due at {alert.nextDueODO.toLocaleString()} km
                    </p>
                  </div>
                </div>
                <AlertTriangle className={`w-5 h-5 ${
                  alert.status === 'critical' ? 'text-red-500' : 'text-amber-500'
                }`} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Maintenance Predictions */}
      {upcomingMaintenance.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Route className="w-4 h-4 text-blue-500" />
              Predicted Maintenance
              {avgDailyDistance > 0 && (
                <span className="text-[10px] font-normal text-slate-400 ml-2">
                  ({avgDailyDistance} km/day)
                </span>
              )}
            </h2>
            <Link to="/maintenance/reminders" className="text-xs font-medium text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors">
              View All →
            </Link>
          </div>
          
          <div className="space-y-2">
            {upcomingMaintenance.map((item) => (
              <div 
                key={item.id}
                className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-2 h-10 rounded-full"
                    style={{ backgroundColor: item.categoryColor }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                      {item.categoryName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.daysRemaining <= 1 
                        ? `Due tomorrow (${format(item.projectedDate, 'MMM d')})`
                        : item.daysRemaining <= 7
                          ? `Due in ${item.daysRemaining} days (${format(item.projectedDate, 'MMM d')})`
                          : item.daysRemaining <= 30
                            ? `Due in ~${Math.ceil(item.daysRemaining / 7)} weeks (${format(item.projectedDate, 'MMM d')})`
                            : `Due in ~${Math.ceil(item.daysRemaining / 30)} months (${format(item.projectedDate, 'MMM d')})`
                      }
                      <span className="text-slate-400 mx-1">•</span>
                      {item.kmRemaining.toLocaleString()} km remaining
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {format(item.projectedDate, 'MMM d')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Trips - Minimal list design */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Recent Trips</h2>
          <Link to="/history" className="text-xs font-medium text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors">
            View All →
          </Link>
        </div>

        {recentTrips.length === 0 ? (
          <div className="text-center py-12 px-6 bg-slate-100 dark:bg-white/[0.03] rounded-3xl">
            <Fuel className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No recent trips.<br/>Add your first fill-up!</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {recentTrips.map((fill) => {
              const originalIndex = activeVehicleFillUps.findIndex(f => f.id === fill.id);
              const metrics = calculateTripMetrics(activeVehicleFillUps, originalIndex);
              
              const kmPerLiter = formatEfficiency2Dec(metrics.kmPerLiter);
              
              return (
                <li key={fill.id} className="bg-white dark:bg-white/[0.03] rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-8 rounded-full ${metrics.distance > 0 ? (metrics.kmPerLiter > 12 ? 'bg-emerald-500' : metrics.kmPerLiter >= 8 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-600'}`}></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{format(new Date(fill.timestamp), 'MMM d, yyyy')}</p>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-0.5">{fill.odometer.toLocaleString()} km</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency2Dec(metrics.tripCost, '').replace('L.E ', '')} <span className="text-[10px] text-slate-500 dark:text-slate-500">EGP</span></p>
                    <p className={`text-xs font-semibold mt-0.5 ${getEfficiencyColorStatus(metrics.kmPerLiter)}`}>{formatEfficiency2Dec(metrics.kmPerLiter)}</p>
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
