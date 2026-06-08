import { useState, useRef, useEffect } from "react";
import {
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  House,
  ListBullets,
  ChartPieSlice,
  Plus,
  GearSix,
  GasPump,
  CaretDown,
  Check,
  Circle,
  Wrench,
  Path,
  Tire,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useFuel } from "./hooks/useFuelContext";
import { useNotifications } from "./hooks/useNotifications";
import { useTranslation } from "react-i18next";
import { authService } from "./services/authService";
import { cloudSyncService } from "./services/cloudSyncService";
import { supabase } from "./lib/supabaseClient";

// Pages
import Dashboard from "./components/Dashboard";
import History from "./components/History";
import FillUpForm from "./components/FillUpForm";
import Analytics from "./components/Analytics";
import SettingsScreen from "./components/Settings";
import TripCostEstimator from "./components/trips/TripCostEstimator";
import TyreCalculator from "./components/TyreCalculator";
import Maintenance from "./components/Maintenance";
import MaintenanceForm from "./components/MaintenanceForm";
import MaintenanceLogEdit from "./components/MaintenanceLogEdit";
import LoginScreen from "./components/LoginScreen";
import DataMigrationModal from "./components/DataMigrationModal";

function Header() {
  const { vehicles, selectedVehicleId, setSelectedVehicleId } = useFuel();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const dropdownRef = useRef(null);
  const featuresDropdownRef = useRef(null);

  const isSettings = location.pathname === "/settings";
  const activeVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const isRtl = i18n.language === "ar";

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
      if (
        featuresDropdownRef.current &&
        !featuresDropdownRef.current.contains(event.target)
      ) {
        setFeaturesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/[0.06] px-5 py-4 flex items-center justify-center">
      <div className="w-full max-w-lg flex items-center justify-between">
        <div className="flex items-center gap-3 relative" ref={dropdownRef}>
          <div className="bg-emerald-500/10 dark:bg-emerald-500/20 p-2 rounded-xl border-0">
            <GasPump
              weight="duotone"
              className="text-emerald-500 dark:text-emerald-400 w-5 h-5 neon-glow"
            />
          </div>

          <button
            onClick={() => !isSettings && setIsOpen(!isOpen)}
            disabled={isSettings}
            className={`flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white tracking-tight focus:outline-none transition-opacity ${isSettings ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
          >
            <span>
              {activeVehicle ? activeVehicle.name : t("select_vehicle")}
            </span>
            {!isSettings && (
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <CaretDown
                  weight="duotone"
                  className="w-5 h-5 text-slate-400"
                />
              </motion.div>
            )}
          </button>

          <AnimatePresence>
            {isOpen && !isSettings && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -10,
                  scale: 0.95,
                  transition: { duration: 0.15 },
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`absolute top-12 ${isRtl ? "right-0" : "left-12"} w-48 bg-white/95 dark:bg-black/90 backdrop-blur-2xl border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-xl overflow-hidden z-50 origin-top-left`}
              >
                <div className="p-1">
                  {vehicles.map((v) => (
                    <NavLink
                      key={v.id}
                      to="#"
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${selectedVehicleId === v.id ? "bg-emerald-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`}
                    >
                      <span className="truncate">{v.name}</span>
                      {selectedVehicleId === v.id && (
                        <Check className="w-4 h-4" />
                      )}
                    </NavLink>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Additional Features Dropdown */}
        <div className="relative" ref={featuresDropdownRef}>
          <button
            onClick={() => setFeaturesOpen(!featuresOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded-xl transition-colors border-0"
          >
            <Wrench weight="duotone" className="w-4 h-4" />
            <span className="hidden sm:inline">{t("tools")}</span>
            <motion.div
              animate={{ rotate: featuresOpen ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <CaretDown weight="duotone" className="w-4 h-4" />
            </motion.div>
          </button>

          <AnimatePresence>
            {featuresOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: -10,
                  scale: 0.95,
                  transition: { duration: 0.15 },
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`absolute top-10 ${isRtl ? "left-0" : "right-0"} w-52 bg-white/95 dark:bg-black/90 backdrop-blur-2xl border border-slate-200/50 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right`}
              >
                <div className="p-1 space-y-0.5">
                  <NavLink
                    to="/trip-estimator"
                    onClick={() => setFeaturesOpen(false)}
                    className={({ isActive }) =>
                      `w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isActive ? "bg-emerald-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`
                    }
                  >
                    <Path weight="duotone" className="w-4 h-4" />
                    {t("trip_estimator")}
                  </NavLink>
                  <NavLink
                    to="/tyre-calculator"
                    onClick={() => setFeaturesOpen(false)}
                    className={({ isActive }) =>
                      `w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isActive ? "bg-emerald-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`
                    }
                  >
                    <Tire weight="duotone" className="w-4 h-4" />
                    {t("tyre_size")}
                  </NavLink>
                  <NavLink
                    to="/maintenance"
                    onClick={() => setFeaturesOpen(false)}
                    className={({ isActive }) =>
                      `w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${isActive ? "bg-emerald-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`
                    }
                  >
                    <Wrench weight="duotone" className="w-4 h-4" />
                    {t("maintenance")}
                  </NavLink>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const cn = (...classes) => classes.filter(Boolean).join(" ");

  // Auth state
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Migration modal state
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationLoadingAction, setMigrationLoadingAction] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);

  // Check for due maintenance reminders on app open
  const {
    maintenanceReminders,
    activeVehicleFillUps,
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    refreshLocalAppState,
  } = useFuel();
  const { checkMaintenanceReminders } = useNotifications();

  useEffect(() => {
    // Single-flight initialization guard:
    // checkSession handles the initial sync on app load.
    // The onAuthStateChange listener is only allowed to run sync
    // for explicit SIGNED_IN events that happen AFTER the initial load.
    let startupInitDone = false;

    const runSync = async (session) => {
      if (!session) return;

      try {
        const status = await cloudSyncService.initialize();

        if (status) {
          const migrationComplete =
            localStorage.getItem("fueltracker-migration-complete") === "true";
          const migrationDecision = localStorage.getItem(
            "fueltracker-migration-decision",
          );

          const countsMatch =
            status.localCounts?.vehicles === status.cloudCounts?.vehicles &&
            status.localCounts?.fillups === status.cloudCounts?.fillups &&
            status.localCounts?.maintenance === status.cloudCounts?.maintenance;

          const hasConflicts = status.detailedDiff?.conflicts?.length > 0;

          const shouldShowModal =
            !migrationComplete &&
            !migrationDecision &&
            (!countsMatch || hasConflicts);

          setSyncStatus(status);
          setShowMigrationModal(shouldShowModal);
        } else {
          setSyncStatus(null);
          setShowMigrationModal(false);
        }
      } catch (error) {
        console.error("[App][sync] Sync initialization error:", error);
        setSyncStatus(null);
        setShowMigrationModal(false);
      }
    };

    const checkSession = async () => {
      const currentSession = await authService.getSession();
      setSession(currentSession);

      // Fetch userId when session is available
      if (currentSession) {
        const fetchedUserId = await cloudSyncService.getUserId();
        setUserId(fetchedUserId);
      }

      await runSync(currentSession);
      setLoading(false);
      startupInitDone = true;
    };

    checkSession();

    const subscription = authService.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);

        // INITIAL_SESSION fires immediately on subscribe and overlaps with
        // checkSession. We skip it here because checkSession handles it.
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_IN" && currentSession) {
          // Only run if startup is already complete; otherwise checkSession
          // handles it. This guards against near-simultaneous events.
          if (!startupInitDone) {
            return;
          }

          // Fetch userId on sign-in
          const fetchedUserId = await cloudSyncService.getUserId();
          setUserId(fetchedUserId);

          await runSync(currentSession);
          navigate("/");
        }

        if (event === "SIGNED_OUT") {
          startupInitDone = false;
          setUserId(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const refreshAppFromLocalStorage = async () => {
    const refreshedVehicles = JSON.parse(
      localStorage.getItem("vehicles") || "[]",
    );

    if (!refreshedVehicles.length) {
      setSelectedVehicleId(null);
      window.dispatchEvent(new Event("storage"));
      return;
    }

    const matchedVehicle = refreshedVehicles.find(
      (v) => v.id === selectedVehicleId,
    );

    setSelectedVehicleId(
      matchedVehicle ? matchedVehicle.id : refreshedVehicles[0].id,
    );

    window.dispatchEvent(new Event("storage"));
  };

  const refreshSyncStatus = async () => {
    const status = await cloudSyncService.initialize();
    setSyncStatus(status);

    const migrationComplete =
      localStorage.getItem("fueltracker-migration-complete") === "true";
    const migrationDecision = localStorage.getItem(
      "fueltracker-migration-decision",
    );

    const countsMatch =
      status?.localCounts?.vehicles === status?.cloudCounts?.vehicles &&
      status?.localCounts?.fillups === status?.cloudCounts?.fillups &&
      status?.localCounts?.maintenance === status?.cloudCounts?.maintenance;

    const hasConflicts = status?.detailedDiff?.conflicts?.length > 0;

    const shouldShowModal =
      !migrationComplete &&
      !migrationDecision &&
      (!countsMatch || hasConflicts);

    setShowMigrationModal(shouldShowModal);
  };

  const handleMigrationDecision = async (decision) => {
    if (migrationLoading) return null;

    setMigrationLoading(true);
    setMigrationLoadingAction(decision);
    setMigrationResult(null);

    try {
      const userId = await cloudSyncService.getUserId();
      const result = await cloudSyncService.continueSyncAfterDecision(
        userId,
        decision,
      );

      if (result?.needsResolution) {
        setSyncStatus(result);
        return result;
      }

      //if (
      //  result?.success &&
      //  (decision === "download" || decision === "merge")
      //) {
      //  try {
      // await refreshAppFromLocalStorage();
      //  } catch (refreshError) {
      //    console.error(
      //      "[Sync][handleMigrationDecision] refreshAppFromLocalStorage failed after successful sync:",
      //      refreshError,
      //    );
      //  }
      //}

      setMigrationResult(result);
      return result;
    } catch (error) {
      console.error("[Sync][handleMigrationDecision] decision failed:", error);

      const failureResult = {
        success: false,
        action: decision,
        message: "Migration failed: " + error.message,
      };

      setMigrationResult(failureResult);
      return failureResult;
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleMigrationResultClose = () => {
  if (migrationResult?.success) {
    const vehicles = JSON.parse(localStorage.getItem("vehicles") || "[]");
    const currentSelectedVehicleId =
      localStorage.getItem("selectedVehicleId");

    if (
      vehicles.length > 0 &&
      !vehicles.some((v) => v.id === currentSelectedVehicleId)
    ) {
      localStorage.setItem("selectedVehicleId", vehicles[0].id);
    }

    setShowMigrationModal(false);
    setMigrationResult(null);
    navigate("/");
    window.location.reload();
    return;
  }

  setMigrationResult(null);
};

  const handleMigrationRetry = () => {
    if (migrationResult?.action) {
      handleMigrationDecision(migrationResult.action);
    }
  };

  const handleMigrationCancel = () => {
    setShowMigrationModal(false);
    setSyncStatus(null);
  };

  useEffect(() => {
    // Get current odometer
    const currentOdometer =
      activeVehicleFillUps.length > 0
        ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer
        : 0;

    // Check for due reminders (with a small delay to ensure everything is loaded)
    const timer = setTimeout(() => {
      checkMaintenanceReminders(maintenanceReminders, currentOdometer);
    }, 2000);

    return () => clearTimeout(timer);
  }, [maintenanceReminders, activeVehicleFillUps, checkMaintenanceReminders]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="pb-28 max-w-lg mx-auto relative min-h-screen flex flex-col bg-slate-50 dark:bg-black transition-colors duration-300">
      <Header />

      <main className="flex-1 px-5 pt-20">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/add" element={<FillUpForm />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/trip-estimator" element={<TripCostEstimator />} />
          <Route path="/tyre-calculator" element={<TyreCalculator />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/maintenance/add" element={<MaintenanceForm />} />
          <Route
            path="/maintenance/edit/:id"
            element={<MaintenanceLogEdit />}
          />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>

      {/* Bottom Tab Bar */}
      {!location.pathname.startsWith("/trip-estimator") &&
        !location.pathname.startsWith("/tyre-calculator") && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/95 backdrop-blur-xl border-t border-slate-200 dark:border-white/[0.06] p-1 z-50 transition-colors duration-300">
            <div className="flex items-center justify-between h-[72px] max-w-lg mx-auto px-4 relative">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative",
                    isActive
                      ? "text-emerald-500"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
                  )
                }
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center relative h-full justify-center">
                    <motion.div
                      whileTap={{ scale: 0.8 }}
                      className="flex flex-col items-center"
                    >
                      <House weight="duotone" className="w-[22px] h-[22px]" />
                      <span className="text-[10px] font-semibold mt-0.5">
                        {t("dashboard")}
                      </span>
                    </motion.div>
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                  </div>
                )}
              </NavLink>

              <NavLink
                to="/history"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative",
                    isActive
                      ? "text-emerald-500"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
                  )
                }
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center relative h-full justify-center">
                    <motion.div
                      whileTap={{ scale: 0.8 }}
                      className="flex flex-col items-center"
                    >
                      <ListBullets
                        weight="duotone"
                        className="w-[22px] h-[22px]"
                      />
                      <span className="text-[10px] font-semibold mt-0.5">
                        {t("history")}
                      </span>
                    </motion.div>
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                  </div>
                )}
              </NavLink>

              {/* Center Floating FAB */}
              <div className="relative -top-5 flex justify-center w-20">
                {(() => {
                  const path = location.pathname;
                  return (
                    <NavLink
                      to={
                        path.startsWith("/maintenance")
                          ? "/maintenance/add"
                          : "/add"
                      }
                      className={({ isActive }) =>
                        cn(
                          "flex items-center justify-center w-[60px] h-[60px] rounded-[1.5rem] shadow-2xl transition-all border-0",
                          isActive
                            ? "bg-emerald-600 text-white shadow-emerald-500/40 dark:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
                            : "bg-emerald-500 text-white shadow-emerald-500/30 dark:shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400",
                        )
                      }
                    >
                      <motion.div
                        whileTap={{ scale: 0.9, rotate: 90 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 10,
                        }}
                      >
                        <Plus className="w-8 h-8" strokeWidth={2.5} />
                      </motion.div>
                    </NavLink>
                  );
                })()}
              </div>

              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative",
                    isActive
                      ? "text-emerald-500"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
                  )
                }
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center relative h-full justify-center">
                    <motion.div
                      whileTap={{ scale: 0.8 }}
                      className="flex flex-col items-center"
                    >
                      <ChartPieSlice
                        weight="duotone"
                        className="w-[22px] h-[22px]"
                      />
                      <span className="text-[10px] font-semibold mt-0.5">
                        {t("stats")}
                      </span>
                    </motion.div>
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                  </div>
                )}
              </NavLink>

              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative",
                    isActive
                      ? "text-emerald-500"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300",
                  )
                }
              >
                {({ isActive }) => (
                  <div className="flex flex-col items-center relative h-full justify-center">
                    <motion.div
                      whileTap={{ scale: 0.8 }}
                      className="flex flex-col items-center"
                    >
                      <GearSix weight="duotone" className="w-[22px] h-[22px]" />
                      <span className="text-[10px] font-semibold mt-0.5">
                        {t("config")}
                      </span>
                    </motion.div>
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 30,
                        }}
                      />
                    )}
                  </div>
                )}
              </NavLink>
            </div>
          </nav>
        )}

      {/* Data Migration Modal */}
      <AnimatePresence>
        {(showMigrationModal || migrationResult) && (
          <DataMigrationModal
            syncStatus={syncStatus}
            onDecision={handleMigrationDecision}
            onCancel={handleMigrationCancel}
            loading={migrationLoading}
            loadingAction={migrationLoadingAction}
            result={migrationResult}
            onCloseResult={handleMigrationResultClose}
            onRetry={handleMigrationRetry}
            disableClose={migrationLoading}
            userId={userId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
