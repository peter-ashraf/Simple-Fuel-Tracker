import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "./ui";
import { Sparkle, TrendUp, TrendDown, Warning, Info, X, ArrowRight, Drop, Gauge, CurrencyDollar, ChartLine, Wrench } from "@phosphor-icons/react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useFuel } from "../hooks/useFuelContext";

export default function ProactiveAlerts() {
  const [dashboardInsightsEnabled] = useLocalStorage(
    "fueltracker-ai-dashboard-insights-enabled-v1",
    true,
  );
  const [insightPreferences] = useLocalStorage(
    "fueltracker-ai-insight-preferences-v1",
    {
      fuelUsage: true,
      averageMileage: true,
      averageCost: true,
      priceTrends: true,
      efficiency: true,
      maintenance: true,
    }
  );
  const [dismissedAlerts, setDismissedAlerts] = useLocalStorage(
    "fueltracker-dismissed-alerts-v1",
    []
  );
  const [alerts, setAlerts] = useState([]);
  const [isExpanded, setIsExpanded] = useLocalStorage(
    "fueltracker-ai-insights-expanded-v1",
    false
  );

  const { activeVehicleFillUps, maintenanceEntries } = useFuel();
  const navigate = useNavigate();

  useEffect(() => {
    if (!dashboardInsightsEnabled) {
      setAlerts([]);
      return;
    }

    const generateAlerts = () => {
      const newAlerts = [];

      // Fuel Usage Alert - always show summary if enabled
      if (insightPreferences.fuelUsage && activeVehicleFillUps.length > 0) {
        const recentFillUps = activeVehicleFillUps.slice(-5);
        const totalLiters = recentFillUps.reduce((sum, f) => sum + f.liters, 0);
        const avgLiters = totalLiters / recentFillUps.length;
        
        if (avgLiters > 35) {
          newAlerts.push({
            id: 'high-fuel-usage',
            type: 'warning',
            icon: Drop,
            title: 'High Fuel Usage',
            message: `Your recent fill-ups average ${avgLiters.toFixed(1)}L, which is higher than usual.`,
            action: 'View details',
            category: 'fuelUsage'
          });
        } else {
          newAlerts.push({
            id: 'fuel-usage-summary',
            type: 'info',
            icon: Drop,
            title: 'Fuel Usage Summary',
            message: `Your recent fill-ups average ${avgLiters.toFixed(1)}L per fill-up.`,
            action: 'View details',
            category: 'fuelUsage'
          });
        }
      }

      // Average Mileage Alert - always show if enabled
      if (insightPreferences.averageMileage && activeVehicleFillUps.length > 1) {
        const sorted = [...activeVehicleFillUps].sort((a, b) => a.odometer - b.odometer);
        let totalDistance = 0;
        let totalLiters = 0;

        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          totalDistance += curr.odometer - prev.odometer;
          totalLiters += curr.liters;
        }

        const avgEfficiency = totalLiters > 0 ? totalDistance / totalLiters : 0;

        if (avgEfficiency > 0) {
          if (avgEfficiency < 10) {
            newAlerts.push({
              id: 'low-efficiency',
              type: 'warning',
              icon: TrendDown,
              title: 'Low Fuel Efficiency',
              message: `Your average efficiency is ${avgEfficiency.toFixed(1)} km/L. Consider checking tire pressure and driving habits.`,
              action: 'Improve efficiency',
              category: 'averageMileage'
            });
          } else if (avgEfficiency > 15) {
            newAlerts.push({
              id: 'high-efficiency',
              type: 'success',
              icon: TrendUp,
              title: 'Excellent Efficiency',
              message: `Your average efficiency is ${avgEfficiency.toFixed(1)} km/L - great job!`,
              action: 'View stats',
              category: 'averageMileage'
            });
          } else {
            newAlerts.push({
              id: 'efficiency-summary',
              type: 'info',
              icon: Gauge,
              title: 'Efficiency Summary',
              message: `Your average efficiency is ${avgEfficiency.toFixed(1)} km/L.`,
              action: 'View stats',
              category: 'averageMileage'
            });
          }
        }
      }

      // Average Cost Alert - always show if enabled
      if (insightPreferences.averageCost && activeVehicleFillUps.length > 0) {
        const recentFillUps = activeVehicleFillUps.slice(-10);
        const totalCost = recentFillUps.reduce((sum, f) => sum + (f.liters * f.pricePerLiter), 0);
        const avgCost = totalCost / recentFillUps.length;

        if (avgCost > 2000) {
          newAlerts.push({
            id: 'high-cost',
            type: 'warning',
            icon: TrendUp,
            title: 'High Fuel Costs',
            message: `Your average fill-up cost is ₹${avgCost.toFixed(0)}. Consider comparing fuel prices.`,
            action: 'View cost analysis',
            category: 'averageCost'
          });
        } else {
          newAlerts.push({
            id: 'cost-summary',
            type: 'info',
            icon: CurrencyDollar,
            title: 'Cost Summary',
            message: `Your average fill-up cost is ₹${avgCost.toFixed(0)}.`,
            action: 'View cost analysis',
            category: 'averageCost'
          });
        }
      }

      // Price Trends Alert
      if (insightPreferences.priceTrends && activeVehicleFillUps.length > 5) {
        const recentPrices = activeVehicleFillUps.slice(-5).map(f => f.pricePerLiter);
        const oldestPrice = recentPrices[0];
        const newestPrice = recentPrices[recentPrices.length - 1];
        const priceChange = ((newestPrice - oldestPrice) / oldestPrice) * 100;

        if (priceChange > 3) {
          newAlerts.push({
            id: 'price-increase',
            type: 'warning',
            icon: TrendUp,
            title: 'Fuel Price Increase',
            message: `Fuel prices have increased by ${priceChange.toFixed(1)}% in your recent fill-ups.`,
            action: 'View price history',
            category: 'priceTrends'
          });
        } else if (priceChange < -3) {
          newAlerts.push({
            id: 'price-decrease',
            type: 'success',
            icon: TrendDown,
            title: 'Fuel Price Decrease',
            message: `Fuel prices have decreased by ${Math.abs(priceChange).toFixed(1)}% - good time to fill up!`,
            action: 'View price history',
            category: 'priceTrends'
          });
        } else {
          newAlerts.push({
            id: 'price-stable',
            type: 'info',
            icon: ChartLine,
            title: 'Price Stable',
            message: `Fuel prices have remained stable at ₹${newestPrice.toFixed(2)} per liter.`,
            action: 'View price history',
            category: 'priceTrends'
          });
        }
      }

      // Maintenance Alert
      if (insightPreferences.maintenance && maintenanceEntries.length > 0) {
        const recentMaintenance = maintenanceEntries.filter(m => {
          const maintenanceDate = new Date(m.date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return maintenanceDate > thirtyDaysAgo;
        });

        if (recentMaintenance.length === 0) {
          const lastMaintenance = maintenanceEntries[maintenanceEntries.length - 1];
          if (lastMaintenance) {
            const lastMaintenanceDate = new Date(lastMaintenance.date);
            const daysSinceMaintenance = Math.floor((new Date() - lastMaintenanceDate) / (1000 * 60 * 60 * 24));
            
            if (daysSinceMaintenance > 60) {
              newAlerts.push({
                id: 'maintenance-due',
                type: 'warning',
                icon: Warning,
                title: 'Maintenance Due',
                message: `It's been ${daysSinceMaintenance} days since your last maintenance. Schedule a check-up.`,
                action: 'Schedule maintenance',
                category: 'maintenance'
              });
            } else {
              newAlerts.push({
                id: 'maintenance-summary',
                type: 'info',
                icon: Wrench,
                title: 'Maintenance Status',
                message: `Last maintenance was ${daysSinceMaintenance} days ago.`,
                action: 'View maintenance',
                category: 'maintenance'
              });
            }
          }
        } else {
          newAlerts.push({
            id: 'maintenance-recent',
            type: 'success',
            icon: Wrench,
            title: 'Maintenance Up to Date',
            message: `You've had ${recentMaintenance.length} maintenance entries in the last 30 days.`,
            action: 'View maintenance',
            category: 'maintenance'
          });
        }
      }

      // Filter out dismissed alerts (only for warning/success alerts, not info summaries)
      const activeAlerts = newAlerts.filter(alert => {
        // Info alerts (summaries) are always shown, not dismissible
        if (alert.type === 'info') return true;
        // Only filter out dismissed warning/success alerts
        return !dismissedAlerts.includes(alert.id);
      });
      setAlerts(activeAlerts);
    };

    generateAlerts();
  }, [dashboardInsightsEnabled, insightPreferences, activeVehicleFillUps, maintenanceEntries, dismissedAlerts]);

  const handleDismiss = (alertId) => {
    setDismissedAlerts(prev => [...prev, alertId]);
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const handleAction = (alert) => {
    switch (alert.category) {
      case 'fuelUsage':
      case 'averageCost':
      case 'priceTrends':
      case 'averageMileage':
      case 'efficiency':
        navigate('/analytics');
        break;
      case 'maintenance':
        navigate('/maintenance');
        break;
      default:
        navigate('/analytics');
    }
  };

  if (!dashboardInsightsEnabled || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div 
        className="flex items-center justify-between gap-2 mb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkle weight="duotone" className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            AI Insights
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({alerts.length})
          </span>
        </div>
        <ArrowRight 
          weight="duotone" 
          className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
        />
      </div>
      
      <div 
        className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 pb-3">
            {alerts.map((alert) => {
        const Icon = alert.icon;
        const bgColor = alert.type === 'warning' 
          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
          : alert.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
            : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20';
        const iconColor = alert.type === 'warning'
          ? 'text-amber-500'
          : alert.type === 'success'
            ? 'text-emerald-500'
            : 'text-blue-500';

        return (
          <Card key={alert.id} className={`px-4 py-3 border ${bgColor}`}>
            <div className="flex items-start gap-3">
              <Icon weight="duotone" className={`h-5 w-5 ${iconColor} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {alert.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {alert.message}
                    </p>
                  </div>
                  {alert.type !== 'info' && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <X weight="duotone" className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {alert.action && (
                  <button
                    onClick={() => handleAction(alert)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                  >
                    {alert.action}
                    <ArrowRight weight="duotone" className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
          </div>
        </div>
      </div>
    </div>
  );
}
