import {
  Trash,
  GasPump,
  CalendarBlank,
  MapPin,
  Pencil,
  FloppyDisk,
  X,
  Check,
  Square,
  CheckSquare,
} from "@phosphor-icons/react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFuel } from "../hooks/useFuelContext";
import { format } from "date-fns";
import { calculateTripMetrics } from "../utils/calculations";
import { PageWrapper, ConfirmModal, cn } from "./ui";
import HistoryCard from "./HistoryCard";
import { useTranslation } from "react-i18next";

export default function History() {
  const {
    activeVehicleFillUps,
    deleteFillUp,
    deleteMultipleFillUps,
    updateFillUp,
    fuelPrices,
  } = useFuel();
  const { t, i18n } = useTranslation();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const isRtl = i18n.language.startsWith("ar");

  const reversedTrips = [...activeVehicleFillUps].reverse();

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === activeVehicleFillUps.length)
      setSelectedIds(new Set());
    else setSelectedIds(new Set(activeVehicleFillUps.map((f) => f.id)));
  };

  const handleBulkDelete = () => {
    deleteMultipleFillUps(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
  };

  return (
    <PageWrapper className="max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("history")}
        </h2>
        <button
          onClick={() => {
            setSelectionMode(!selectionMode);
            if (!selectionMode) setSelectedIds(new Set());
          }}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-1 bg-slate-200 dark:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-700/50"
        >
          {activeVehicleFillUps.length} {t("entries").toLowerCase()}
        </button>
      </div>

      {activeVehicleFillUps.length === 0 ? (
        <div className="text-center py-16 px-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl">
          <GasPump weight="duotone" className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {t("untracked")}
          </p>
        </div>
      ) : (
        <ul className="space-y-4 pb-4">
          {reversedTrips.map((fill, reversedIndex) => {
            const originalIndex =
              activeVehicleFillUps.length - 1 - reversedIndex;
            const isSelected = selectedIds.has(fill.id);
            return (
              <motion.li
                key={fill.id}
                className="relative flex items-center"
                layout
              >
                <AnimatePresence>
                  {selectionMode && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8, x: isRtl ? 10 : -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: isRtl ? 10 : -10 }}
                      onClick={() => toggleSelection(fill.id)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600"}`}
                    >
                      {isSelected && <Check weight="duotone" className="w-3.5 h-3.5" />}
                    </motion.button>
                  )}
                </AnimatePresence>
                <motion.div
                  className="flex-1"
                  animate={{
                    scaleX: selectionMode ? 0.92 : 1,
                    x: selectionMode ? (isRtl ? -24 : 24) : 0,
                    originX: isRtl ? 1 : 0,
                  }}
                >
                  <HistoryCard
                    fill={fill}
                    index={originalIndex}
                    totalFillUps={activeVehicleFillUps.length}
                    fillUps={activeVehicleFillUps}
                    onDelete={deleteFillUp}
                    onUpdate={updateFillUp}
                    fuelPrices={fuelPrices}
                  />
                </motion.div>
              </motion.li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title={t("delete")}
        message={t("delete") + "?"}
        confirmText={t("delete")}
        variant="danger"
      />

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[95%] sm:max-w-[500px] bg-slate-900 dark:bg-slate-800 text-white rounded-3xl shadow-2xl p-3 flex items-center justify-between z-50 border border-white/10"
          >
            <div className="flex items-center gap-2 ms-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                {selectedIds.size}
              </div>
              <span className="font-bold text-xs">{t("selected")}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={selectAll}
                className="h-10 px-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-2 border border-white/5"
              >
                {selectedIds.size === activeVehicleFillUps.length ? (
                  <Square weight="duotone" className="w-4 h-4" />
                ) : (
                  <CheckSquare weight="duotone" className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="h-10 px-3 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-2"
              >
                <Trash weight="duotone" className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectionMode(false);
                }}
                className="h-10 px-3 text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
