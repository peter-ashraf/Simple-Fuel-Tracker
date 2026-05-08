import { useState, useMemo } from "react";
import {
  Pulse,
  TrendUp,
  CurrencyDollar,
  GasPump,
  Wrench,
  Warning,
  Bell,
  GearSix,
  Path,
  CaretRight,
  ChartBar,
  TrendUp as TrendUpIcon,
  Lightning,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, MetricCard, PageWrapper, Modal, cn } from "./ui";
import { useFuel } from "../hooks/useFuelContext";
import {
  calculateTripMetrics,
  calculateAverageDailyDistance,
  formatPrediction,
} from "../utils/calculations";
import {
  formatTo2Decimals,
  formatCurrency2Dec,
  formatEfficiency2Dec,
} from "../utils/formatting";
import { getMaintenanceCategory } from "../data/maintenanceCategories";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const {
    stats,
    activeVehicleFillUps,
    maintenanceEntries,
    maintenanceSettings,
  } = useFuel();
  const { t, i18n } = useTranslation();
  const [predictedModalOpen, setPredictedModalOpen] = useState(false);
  const [selectedBarIdx, setSelectedBarIdx] = useState(null);
  const [selectedDotIdx, setSelectedDotIdx] = useState(null);
  const recentTrips = [...activeVehicleFillUps].reverse().slice(0, 5);
  const isRtl = i18n.language.startsWith("ar");

  const currentOdometer =
    activeVehicleFillUps.length > 0
      ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer
      : 0;

  const getMaintenanceAlerts = () => {
    if (!maintenanceEntries?.length || currentOdometer === 0) return [];
    return maintenanceEntries
      .filter((entry) => {
        const categorySettings =
          maintenanceSettings?.categorySettings?.[entry.type];
        if (categorySettings?.enabled === false) return false;
        return entry.nextDueODO && entry.alertODO;
      })
      .map((entry) => {
        let status = "ok";
        if (currentOdometer >= entry.nextDueODO) status = "critical";
        else if (currentOdometer >= entry.alertODO) status = "warning";
        const category = getMaintenanceCategory(entry.type);
        return {
          ...entry,
          status,
          categoryId: category.id,
          categoryColor: category.color,
          remainingKm: Math.max(0, entry.nextDueODO - currentOdometer),
        };
      })
      .filter((item) => item.status === "critical")
      .sort((a, b) => a.remainingKm - b.remainingKm)
      .slice(0, 3);
  };

  const maintenanceAlerts = getMaintenanceAlerts();
  const avgDailyDistance = calculateAverageDailyDistance(activeVehicleFillUps);

  const getUpcomingMaintenance = () => {
    if (
      !maintenanceEntries?.length ||
      currentOdometer === 0 ||
      avgDailyDistance <= 0
    )
      return [];
    return maintenanceEntries
      .filter((entry) => {
        const categorySettings =
          maintenanceSettings?.categorySettings?.[entry.type];
        if (categorySettings?.enabled === false) return false;
        
        // Only show if it's within the user-defined alert threshold
        // (odometer is between alertODO and nextDueODO)
        return entry.nextDueODO && entry.alertODO && 
               currentOdometer >= entry.alertODO && 
               currentOdometer < entry.nextDueODO;
      })
      .map((entry) => {
        const kmRemaining = entry.nextDueODO - currentOdometer;
        const daysRemaining = Math.ceil(kmRemaining / avgDailyDistance);
        const projectedDate = new Date();
        projectedDate.setDate(projectedDate.getDate() + daysRemaining);
        const category = getMaintenanceCategory(entry.type);
        return {
          ...entry,
          categoryId: category.id,
          categoryColor: category.color,
          kmRemaining,
          daysRemaining,
          projectedDate,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 3);
  };

  const upcomingMaintenance = getUpcomingMaintenance();

  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === 0) return "text-slate-500";
    if (kmPerL > 12) return "text-emerald-600";
    if (kmPerL >= 8) return "text-amber-600";
    return "text-red-600";
  };

  const avgKmL =
    stats.avgKmPerLiter > 0
      ? formatTo2Decimals(stats.avgKmPerLiter).toFixed(2)
      : "-";
  const avgL100 =
    stats.avgL100km > 0 ? formatTo2Decimals(stats.avgL100km).toFixed(2) : "-";

  // --- Widget Data: Monthly Spending (last 6 months) ---
  const monthlySpending = useMemo(() => {
    if (activeVehicleFillUps.length === 0) return [];
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), total: 0, label: format(d, 'MMM') });
    }
    activeVehicleFillUps.forEach(f => {
      const fd = new Date(f.timestamp);
      const match = months.find(m => m.year === fd.getFullYear() && m.month === fd.getMonth());
      if (match) match.total += f.liters * (f.pricePerLiter || 0);
    });
    return months;
  }, [activeVehicleFillUps]);

  // --- Widget Data: Efficiency Trend (last 10 fill-ups) ---
  const efficiencyTrend = useMemo(() => {
    if (activeVehicleFillUps.length < 2) return [];
    const points = [];
    for (let i = 1; i < activeVehicleFillUps.length; i++) {
      const m = calculateTripMetrics(activeVehicleFillUps, i);
      if (m.kmPerLiter > 0) points.push({ index: i, value: m.kmPerLiter });
    }
    return points.slice(-10);
  }, [activeVehicleFillUps]);

  // --- Widget Data: Cost per KM ---
  const costPerKm = useMemo(() => {
    if (stats.totalDistance > 0 && stats.totalCost > 0) {
      return formatTo2Decimals(stats.totalCost / stats.totalDistance);
    }
    return 0;
  }, [stats]);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] overflow-hidden">
      <PageWrapper className="flex-1 flex flex-col min-h-0 space-y-6">
        <div className="flex-shrink-0 pt-1">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
              {t("overview")}
            </h1>
          </div>

          <section className="grid grid-cols-2 gap-3 mb-6">
            <MetricCard className="flex flex-col justify-between min-h-[120px] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Pulse weight="duotone" className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {t('avg_km_l_short')}
                </span>
              </div>
              <span
                className={`text-4xl font-bold tracking-tighter ${getEfficiencyColorStatus(stats.avgKmPerLiter)}`}
              >
                {avgKmL}
              </span>
            </MetricCard>

            <MetricCard
              variant="secondary"
              className="flex flex-col justify-between min-h-[120px] p-4"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <TrendUp weight="duotone" className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {t('l_100km_short')}
                </span>
              </div>
              <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">
                {avgL100}
              </span>
            </MetricCard>

            <MetricCard className="flex flex-col justify-between min-h-[120px] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <CurrencyDollar weight="duotone" className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {t("total_spent")}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">
                  {formatCurrency2Dec(stats.totalCost, "").replace("L.E ", "")}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  {t('currency')}
                </span>
              </div>
            </MetricCard>

            <MetricCard
              variant="secondary"
              className="flex flex-col justify-between min-h-[120px] p-4"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <GasPump weight="duotone" className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  {t("history")}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter">
                  {stats.totalFillUps}
                </span>
              </div>
            </MetricCard>
          </section>

          {(maintenanceAlerts.length > 0 || upcomingMaintenance.length > 0) && (
            <div className="grid grid-cols-1 gap-2 mb-6">
              {maintenanceAlerts.length > 0 && (
                <Link
                  to="/maintenance"
                  className="w-full flex items-center justify-between p-3 bg-red-500/10 dark:bg-red-500/20 border border-red-500/20 rounded-2xl"
                >
                  <div className="flex items-center gap-2">
                    <Bell weight="duotone" className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      {maintenanceAlerts.length} {t("overdue_excl")}
                    </span>
                  </div>
                  <CaretRight weight="duotone"
                    className={cn(
                      "w-4 h-4 text-red-400",
                      isRtl && "rotate-180",
                    )}
                  />
                </Link>
              )}
              {upcomingMaintenance.length > 0 && (
                <button
                  onClick={() => setPredictedModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 rounded-2xl"
                >
                  <div className="flex items-center gap-2">
                    <Path weight="duotone" className="w-4 h-4 text-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {t("due_soon")}: {t(upcomingMaintenance[0].categoryId)}
                      </span>
                      <span className="text-[10px] text-blue-500/70 dark:text-blue-400/50 font-medium">
                        {avgDailyDistance.toFixed(1)} {t('km_day')} {t('predicted')}
                      </span>
                    </div>
                  </div>
                  <CaretRight weight="duotone"
                    className={cn(
                      "w-4 h-4 text-blue-400",
                      isRtl && "rotate-180",
                    )}
                  />
                </button>
              )}
            </div>
          )}

          {/* --- Insights Widgets --- */}
          {activeVehicleFillUps.length >= 2 && (
            <section className="space-y-3 mb-6">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight px-1">
                {t('insights') || 'Insights'}
              </h2>

              {/* Monthly Spending Bar Chart */}
              {monthlySpending.length > 0 && monthlySpending.some(m => m.total > 0) && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <ChartBar weight="duotone" className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        {t('monthly_spending')}
                      </span>
                    </div>
                    {selectedBarIdx !== null && monthlySpending[selectedBarIdx] && (
                      <span className="text-xs font-black text-emerald-500 animate-pulse">
                        {formatTo2Decimals(monthlySpending[selectedBarIdx].total).toFixed(0)} {t('currency')}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const maxVal = Math.max(...monthlySpending.map(m => m.total), 1);
                    const barW = 28;
                    const gap = 14;
                    const chartH = 80;
                    const totalW = monthlySpending.length * (barW + gap) - gap;
                    return (
                      <div className="flex justify-center">
                        <svg width={totalW} height={chartH + 22} viewBox={`0 0 ${totalW} ${chartH + 22}`}>
                          {monthlySpending.map((m, i) => {
                            const barH = maxVal > 0 ? (m.total / maxVal) * chartH : 0;
                            const x = i * (barW + gap);
                            const isCurrentMonth = i === monthlySpending.length - 1;
                            const isSelected = selectedBarIdx === i;
                            return (
                              <g key={i} onClick={() => setSelectedBarIdx(isSelected ? null : i)} style={{ cursor: 'pointer' }}>
                                {/* Invisible wider tap target */}
                                <rect x={x - 4} y={0} width={barW + 8} height={chartH + 22} fill="transparent" />
                                <rect
                                  x={x} y={chartH - barH} width={barW} height={Math.max(barH, 3)}
                                  rx={6}
                                  fill={isSelected ? '#10b981' : isCurrentMonth ? '#10b981cc' : '#10b98140'}
                                  className="transition-all duration-300"
                                />
                                {isSelected && barH > 10 && (
                                  <text x={x + barW / 2} y={chartH - barH - 6} textAnchor="middle" className="fill-emerald-500" style={{ fontSize: '9px', fontWeight: 800 }}>
                                    {formatTo2Decimals(m.total).toFixed(0)}
                                  </text>
                                )}
                                <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" style={{ fontSize: '9px', fontWeight: isSelected ? 800 : 600, fill: isSelected ? '#10b981' : '#94a3b8' }}>
                                  {m.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </Card>
              )}

              {/* Efficiency Trend Sparkline */}
              {efficiencyTrend.length >= 3 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <TrendUpIcon weight="duotone" className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        {t('efficiency_trend')}
                      </span>
                    </div>
                    {selectedDotIdx !== null && efficiencyTrend[selectedDotIdx] ? (
                      <span className="text-xs font-black text-emerald-500">
                        {efficiencyTrend[selectedDotIdx].value.toFixed(2)} {t('avg_km_l_short')}
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-500">
                        {t('last_n_fillups', { count: efficiencyTrend.length })}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const values = efficiencyTrend.map(p => p.value);
                    const minV = Math.min(...values) * 0.9;
                    const maxV = Math.max(...values) * 1.1;
                    const range = maxV - minV || 1;
                    const w = 280;
                    const h = 60;
                    const points = values.map((v, i) => {
                      const x = (i / (values.length - 1)) * w;
                      const y = h - ((v - minV) / range) * h;
                      return { x, y, value: v };
                    });
                    const linePath = `M${points.map(p => `${p.x},${p.y}`).join(' L')}`;
                    const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
                    return (
                      <div className="flex justify-center">
                        <svg width="100%" height={h + 10} viewBox={`-4 -4 ${w + 8} ${h + 18}`} preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={areaPath} fill="url(#sparkGrad)" />
                          <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p, i) => {
                            const isSelected = selectedDotIdx === i;
                            return (
                              <g key={i} onClick={() => setSelectedDotIdx(isSelected ? null : i)} style={{ cursor: 'pointer' }}>
                                {/* Wider tap target */}
                                <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
                                {/* Visible dot */}
                                <circle cx={p.x} cy={p.y} r={isSelected ? 5 : 2.5} fill={isSelected ? '#10b981' : '#10b981'} className="transition-all duration-200" />
                                {isSelected && (
                                  <circle cx={p.x} cy={p.y} r={8} fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.4" />
                                )}
                                {isSelected && (
                                  <text x={p.x} y={p.y - 12} textAnchor="middle" style={{ fontSize: '10px', fontWeight: 800, fill: '#10b981' }}>
                                    {p.value.toFixed(2)}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </Card>
              )}

              {/* Cost per KM */}
              {costPerKm > 0 && (
                <MetricCard className="flex flex-col justify-between p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightning weight="duotone" className="w-3 h-3 text-violet-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {t('cost_per_km') || 'Cost / KM'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">
                      {costPerKm.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {t('currency')}/{t('unit_km_h')?.replace('/h','') || 'km'}
                    </span>
                  </div>
                </MetricCard>
              )}
            </section>
          )}
        </div>

        <section className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {t("history")}
            </h2>
            <Link
              to="/history"
              className="text-xs font-medium text-emerald-500 dark:text-emerald-400"
            >
              {t("overview")}
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-4">
            <ul className="space-y-2">
              {activeVehicleFillUps
                .slice()
                .reverse()
                .map((fill) => {
                  const originalIndex = activeVehicleFillUps.findIndex(
                    (f) => f.id === fill.id,
                  );
                  const metrics = calculateTripMetrics(
                    activeVehicleFillUps,
                    originalIndex,
                  );
                  return (
                    <li
                      key={fill.id}
                      className="bg-white dark:bg-white/[0.03] rounded-2xl p-4 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-1 h-6 rounded-full ${metrics.distance > 0 ? (metrics.kmPerLiter > 12 ? "bg-emerald-500" : metrics.kmPerLiter >= 8 ? "bg-amber-500" : "bg-red-500") : "bg-slate-600"}`}
                        ></div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {format(new Date(fill.timestamp), "MMM d")}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {fill.odometer.toLocaleString()} km
                          </p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {formatCurrency2Dec(metrics.tripCost, "").replace(
                            "L.E ",
                            "",
                          )}{" "}
                          <span className="text-[10px] text-slate-500">
                            {t('currency')}
                          </span>
                        </p>
                        <p
                          className={`text-[10px] font-bold mt-0.5 ${getEfficiencyColorStatus(metrics.kmPerLiter)}`}
                        >
                          {formatEfficiency2Dec(metrics.kmPerLiter)}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>

        <Modal
          isOpen={predictedModalOpen}
          onClose={() => setPredictedModalOpen(false)}
          title={t("due_soon")}
        >
          <div className="space-y-2 p-1">
            {upcomingMaintenance.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-10 rounded-full"
                    style={{ backgroundColor: item.categoryColor }}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                      {t(item.categoryId)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.kmRemaining.toLocaleString()} {t('km_left')}
                    </p>
                  </div>
                  <div className="text-end text-xs font-bold text-blue-600 dark:text-blue-400">
                    {format(item.projectedDate, "MMM d")}
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
