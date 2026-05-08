import { useState } from "react";
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
